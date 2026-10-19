import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { gerarCsv, enviarCsv } from './csv.js';
import { registrarMovimentacao, validarMovimentacao } from './movimentacoes.js';
import { ErroHttp, lerId, lerPaginacao } from './http.js';

export { ErroHttp, lerId, lerPaginacao };

const TIPOS_IMAGEM = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
export const TAMANHO_MAX_IMAGEM = '5mb';

function validar(corpo, campos) {
  const dados = {};
  for (const [nome, regra] of Object.entries(campos)) {
    let valor = corpo?.[nome];
    if (typeof valor === 'string') valor = valor.trim();

    if (valor === undefined || valor === null || valor === '') {
      if (regra.obrigatorio) throw new ErroHttp(400, `O campo "${regra.rotulo}" é obrigatório.`);
      dados[nome] = regra.padrao ?? null;
      continue;
    }

    if (regra.tipo === 'numero' || regra.tipo === 'inteiro') {
      valor = Number(valor);
      const inteiro = regra.tipo === 'inteiro';
      if (!Number.isFinite(valor) || valor < 0 || (inteiro && !Number.isInteger(valor))) {
        throw new ErroHttp(400, `O campo "${regra.rotulo}" deve ser um número${inteiro ? ' inteiro' : ''} maior ou igual a zero.`);
      }
    } else {
      valor = String(valor);
      if (regra.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        throw new ErroHttp(400, `O campo "${regra.rotulo}" deve estar no formato AAAA-MM-DD.`);
      }
    }

    if (regra.opcoes && !regra.opcoes.includes(valor)) {
      throw new ErroHttp(400, `Valor inválido para "${regra.rotulo}". Use: ${regra.opcoes.join(', ')}.`);
    }
    dados[nome] = valor;
  }
  return dados;
}

export function criarRotasCrud(db, recurso, { pastaImagens, exigirAdmin }) {
  const { tabela, select, campos, extras = {}, ordem = 't.nome', imagem = false } = recurso;
  const router = Router();
  const nomesCampos = Object.keys(campos);
  const temEstoque = 'quantidade' in campos;

  const ordenaveis = { id: 't.id', criado_em: 't.criado_em' };
  for (const [nome, regra] of Object.entries(campos)) {
    if (nome === 'colecao_id') continue;
    ordenaveis[nome] = regra.tipo === 'texto' ? db.sql.semCaixa(`t.${nome}`) : `t.${nome}`;
  }
  for (const [nome, extra] of Object.entries(extras)) {
    ordenaveis[nome] = extra.texto ? db.sql.semCaixa(extra.sql) : extra.sql;
  }

  const colunasCsv = [
    { chave: 'id', rotulo: 'ID' },
    ...nomesCampos.map((nome) =>
      nome === 'colecao_id' ? { chave: 'colecao_nome', rotulo: 'Coleção' } : { chave: nome, rotulo: campos[nome].rotulo, tipo: campos[nome].tipo }
    ),
    ...Object.entries(extras).filter(([nome]) => nome !== 'colecao_nome').map(([chave, e]) => ({ chave, rotulo: e.rotulo })),
    { chave: 'criado_em', rotulo: 'Cadastrado em' },
  ];

  const apagarArquivoImagem = (nome) => {
    if (nome) fs.rmSync(path.join(pastaImagens, path.basename(nome)), { force: true });
  };

  const buscar = async (id, conexao = db, bloquear = false) => {
    const item = await conexao.um(`${select} WHERE t.id = ?${bloquear ? db.sql.bloquearLinha : ''}`, [id]);
    if (!item) throw new ErroHttp(404, 'Registro não encontrado.');
    return item;
  };

  const montarConsulta = (query) => {
    const filtros = [];
    const params = [];
    if (query.busca) {
      filtros.push(`t.nome ${db.sql.like} ?`);
      params.push(`%${query.busca}%`);
    }
    if ('colecao_id' in campos && query.colecao_id) {
      filtros.push('t.colecao_id = ?');
      params.push(lerId(query.colecao_id));
    }
    if (temEstoque && query.estoque_baixo === '1') {
      filtros.push('t.quantidade <= t.estoque_minimo');
    }
    const where = filtros.length ? ` WHERE ${filtros.join(' AND ')}` : '';

    let orderBy = ordem;
    if (query.ordenar) {
      const coluna = ordenaveis[query.ordenar];
      if (!coluna) throw new ErroHttp(400, `Não é possível ordenar por "${query.ordenar}".`);
      orderBy = `${coluna} ${query.direcao === 'desc' ? 'DESC' : 'ASC'}, t.id`;
    }
    return { where, params, orderBy };
  };

  router.get('/', async (req, res) => {
    const { where, params, orderBy } = montarConsulta(req.query);
    const paginacao = lerPaginacao(req.query);
    const { total } = await db.um(`SELECT COUNT(*) AS total FROM (${select}${where}) AS contagem`, params);
    const itens = await db.consultar(`${select}${where} ORDER BY ${orderBy}${paginacao?.sql ?? ''}`, [
      ...params,
      ...(paginacao?.params ?? []),
    ]);
    res.setHeader('X-Total-Count', total);
    res.json(itens);
  });

  router.get('/exportar.csv', async (req, res) => {
    const { where, params, orderBy } = montarConsulta(req.query);
    const itens = await db.consultar(`${select}${where} ORDER BY ${orderBy}`, params);
    enviarCsv(res, tabela, gerarCsv(itens, colunasCsv));
  });

  router.get('/:id', async (req, res) => {
    res.json(await buscar(lerId(req.params.id)));
  });

  router.post('/', exigirAdmin, async (req, res) => {
    const dados = validar(req.body, campos);
    const marcadores = nomesCampos.map(() => '?').join(', ');
    const id = await db.transacao(async (tx) => {
      const { id } = await tx.um(
        `INSERT INTO ${tabela} (${nomesCampos.join(', ')}) VALUES (${marcadores}) RETURNING id`,
        nomesCampos.map((c) => dados[c])
      );
      if (temEstoque && dados.quantidade > 0) {
        await registrarMovimentacao(tx, {
          recurso: tabela, item: { id, ...dados }, operacao: 'entrada', motivo: 'Cadastro inicial',
          quantidade: dados.quantidade, quantidadeAnterior: 0, usuario: req.usuario,
        });
      }
      return id;
    });
    res.status(201).json(await buscar(id));
  });

  router.put('/:id', exigirAdmin, async (req, res) => {
    const id = lerId(req.params.id);
    const dados = validar(req.body, campos);
    const atribuicoes = nomesCampos.map((c) => `${c} = ?`).join(', ');
    await db.transacao(async (tx) => {
      const anterior = await buscar(id, tx, true);
      await tx.executar(`UPDATE ${tabela} SET ${atribuicoes} WHERE id = ?`, [...nomesCampos.map((c) => dados[c]), id]);
      const diferenca = temEstoque ? dados.quantidade - anterior.quantidade : 0;
      if (diferenca !== 0) {
        await registrarMovimentacao(tx, {
          recurso: tabela, item: { ...anterior, ...dados }, operacao: diferenca > 0 ? 'entrada' : 'saida',
          motivo: 'Ajuste de inventário', quantidade: Math.abs(diferenca), quantidadeAnterior: anterior.quantidade,
          observacao: 'Quantidade alterada na edição do cadastro', usuario: req.usuario,
        });
      }
    });
    res.json(await buscar(id));
  });

  router.delete('/:id', exigirAdmin, async (req, res) => {
    const id = lerId(req.params.id);
    const item = await buscar(id);
    await db.executar(`DELETE FROM ${tabela} WHERE id = ?`, [id]);
    if (imagem) apagarArquivoImagem(item.imagem);
    res.status(204).end();
  });

  if (imagem) {
    router.put('/:id/imagem', exigirAdmin, express.raw({ type: 'image/*', limit: TAMANHO_MAX_IMAGEM }), async (req, res) => {
      const id = lerId(req.params.id);
      const item = await buscar(id);
      const extensao = TIPOS_IMAGEM[req.get('Content-Type')];
      if (!extensao) throw new ErroHttp(400, 'Formato de imagem inválido. Use PNG, JPG, WEBP ou GIF.');
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new ErroHttp(400, 'Nenhuma imagem enviada.');

      const nomeArquivo = `${tabela}-${id}-${Date.now()}${extensao}`;
      fs.mkdirSync(pastaImagens, { recursive: true });
      fs.writeFileSync(path.join(pastaImagens, nomeArquivo), req.body);
      await db.executar(`UPDATE ${tabela} SET imagem = ? WHERE id = ?`, [nomeArquivo, id]);
      apagarArquivoImagem(item.imagem);
      res.json(await buscar(id));
    });

    router.delete('/:id/imagem', exigirAdmin, async (req, res) => {
      const id = lerId(req.params.id);
      const item = await buscar(id);
      await db.executar(`UPDATE ${tabela} SET imagem = NULL WHERE id = ?`, [id]);
      apagarArquivoImagem(item.imagem);
      res.json(await buscar(id));
    });
  }

  if (temEstoque) {
    router.patch('/:id/estoque', async (req, res) => {
      const id = lerId(req.params.id);
      await db.transacao(async (tx) => {
        const item = await buscar(id, tx, true);
        const mov = validarMovimentacao(req.body, item);
        const novaQuantidade = mov.operacao === 'entrada' ? item.quantidade + mov.quantidade : item.quantidade - mov.quantidade;
        if (novaQuantidade < 0) {
          throw new ErroHttp(400, `Estoque insuficiente: há apenas ${item.quantidade} unidade(s).`);
        }
        await tx.executar(`UPDATE ${tabela} SET quantidade = ? WHERE id = ?`, [novaQuantidade, id]);
        await registrarMovimentacao(tx, { recurso: tabela, item, quantidadeAnterior: item.quantidade, usuario: req.usuario, ...mov });
      });
      res.json(await buscar(id));
    });

    router.get('/:id/movimentacoes', async (req, res) => {
      const id = lerId(req.params.id);
      res.json(
        await db.consultar('SELECT * FROM movimentacoes WHERE recurso = ? AND item_id = ? ORDER BY id DESC LIMIT 100', [tabela, id])
      );
    });
  }

  return router;
}
