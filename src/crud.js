import { Router } from 'express';

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function lerId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'ID inválido.');
  return id;
}

// Converte e valida o corpo da requisição de acordo com a definição dos campos
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

// Cria as rotas de CRUD (listar, buscar, criar, atualizar, excluir) para um recurso
export function criarRotasCrud(db, { tabela, select, campos, ordem = 't.nome' }) {
  const router = Router();
  const nomesCampos = Object.keys(campos);
  const temEstoque = 'quantidade' in campos;

  const buscar = (id) => {
    const item = db.prepare(`${select} WHERE t.id = ?`).get(id);
    if (!item) throw new ErroHttp(404, 'Registro não encontrado.');
    return item;
  };

  // READ - lista com filtros opcionais: ?busca=, ?colecao_id=, ?estoque_baixo=1
  router.get('/', (req, res) => {
    const filtros = [];
    const params = [];
    if (req.query.busca) {
      filtros.push('t.nome LIKE ?');
      params.push(`%${req.query.busca}%`);
    }
    if ('colecao_id' in campos && req.query.colecao_id) {
      filtros.push('t.colecao_id = ?');
      params.push(lerId(req.query.colecao_id));
    }
    if (temEstoque && req.query.estoque_baixo === '1') {
      filtros.push('t.quantidade <= t.estoque_minimo');
    }
    const where = filtros.length ? ` WHERE ${filtros.join(' AND ')}` : '';
    res.json(db.prepare(`${select}${where} ORDER BY ${ordem}`).all(...params));
  });

  // READ - um registro
  router.get('/:id', (req, res) => {
    res.json(buscar(lerId(req.params.id)));
  });

  // CREATE
  router.post('/', (req, res) => {
    const dados = validar(req.body, campos);
    const marcadores = nomesCampos.map(() => '?').join(', ');
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO ${tabela} (${nomesCampos.join(', ')}) VALUES (${marcadores})`)
      .run(...nomesCampos.map((c) => dados[c]));
    res.status(201).json(buscar(Number(lastInsertRowid)));
  });

  // UPDATE
  router.put('/:id', (req, res) => {
    const id = lerId(req.params.id);
    buscar(id);
    const dados = validar(req.body, campos);
    const atribuicoes = nomesCampos.map((c) => `${c} = ?`).join(', ');
    db.prepare(`UPDATE ${tabela} SET ${atribuicoes} WHERE id = ?`).run(...nomesCampos.map((c) => dados[c]), id);
    res.json(buscar(id));
  });

  // DELETE
  router.delete('/:id', (req, res) => {
    const id = lerId(req.params.id);
    buscar(id);
    db.prepare(`DELETE FROM ${tabela} WHERE id = ?`).run(id);
    res.status(204).end();
  });

  // Movimentação de estoque: { "operacao": "entrada" | "saida", "quantidade": 5 }
  if (temEstoque) {
    router.patch('/:id/estoque', (req, res) => {
      const id = lerId(req.params.id);
      const { operacao } = req.body ?? {};
      const quantidade = Number(req.body?.quantidade);
      if (operacao !== 'entrada' && operacao !== 'saida') {
        throw new ErroHttp(400, 'A operação deve ser "entrada" ou "saida".');
      }
      if (!Number.isInteger(quantidade) || quantidade <= 0) {
        throw new ErroHttp(400, 'A quantidade deve ser um número inteiro maior que zero.');
      }
      const item = buscar(id);
      const novaQuantidade = operacao === 'entrada' ? item.quantidade + quantidade : item.quantidade - quantidade;
      if (novaQuantidade < 0) {
        throw new ErroHttp(400, `Estoque insuficiente: há apenas ${item.quantidade} unidade(s).`);
      }
      db.prepare(`UPDATE ${tabela} SET quantidade = ? WHERE id = ?`).run(novaQuantidade, id);
      res.json(buscar(id));
    });
  }

  return router;
}
