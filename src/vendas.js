import { Router } from 'express';
import { ErroHttp, lerId, lerPaginacao } from './http.js';
import { OPCOES } from './recursos.js';
import { TABELAS_ESTOQUE } from './db.js';
import { registrarMovimentacao } from './movimentacoes.js';

const MAX_ITENS = 100;
const SEM_FORMA = 'Não informada';
const centavos = (valor) => Math.round(valor * 100) / 100;

function lerItens(lista) {
  if (!Array.isArray(lista) || lista.length === 0) throw new ErroHttp(400, 'Adicione pelo menos um item à venda.');
  if (lista.length > MAX_ITENS) throw new ErroHttp(400, `Uma venda pode ter no máximo ${MAX_ITENS} itens.`);
  const agrupados = new Map();
  for (const bruto of lista) {
    const recurso = String(bruto?.recurso ?? '');
    if (!TABELAS_ESTOQUE.includes(recurso)) throw new ErroHttp(400, 'Tipo de item inválido na venda.');
    const itemId = lerId(bruto?.item_id);
    const quantidade = Number(bruto?.quantidade);
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new ErroHttp(400, 'A quantidade de cada item deve ser um número inteiro maior que zero.');
    }
    const informado = bruto?.preco_unitario;
    const preco = informado === undefined || informado === null || informado === '' ? null : Number(informado);
    if (preco !== null && (!Number.isFinite(preco) || preco < 0)) {
      throw new ErroHttp(400, 'O preço de cada item deve ser um número maior ou igual a zero.');
    }
    const chave = `${recurso}:${itemId}`;
    const existente = agrupados.get(chave);
    if (existente) existente.quantidade += quantidade;
    else agrupados.set(chave, { recurso, itemId, quantidade, preco });
  }
  return [...agrupados.values()].sort((a, b) => a.recurso.localeCompare(b.recurso) || a.itemId - b.itemId);
}

function lerFormaPagamento(valor, opcional) {
  if ((valor === undefined || valor === null || valor === '') && opcional) return SEM_FORMA;
  const forma = String(valor ?? '').trim();
  if (!OPCOES.formasPagamento.includes(forma)) {
    throw new ErroHttp(400, `Forma de pagamento inválida. Use: ${OPCOES.formasPagamento.join(', ')}.`);
  }
  return forma;
}

function calcularDesconto(desconto, subtotal) {
  if (!desconto || desconto.valor === undefined || desconto.valor === null || desconto.valor === '') return 0;
  const valor = Number(desconto.valor);
  if (!Number.isFinite(valor) || valor < 0) throw new ErroHttp(400, 'O desconto deve ser um número maior ou igual a zero.');
  if (desconto.tipo === 'percentual') {
    if (valor > 100) throw new ErroHttp(400, 'O desconto percentual deve ser de 0 a 100%.');
    return centavos((subtotal * valor) / 100);
  }
  if (desconto.tipo !== 'valor') throw new ErroHttp(400, 'O tipo de desconto deve ser "percentual" ou "valor".');
  if (valor > subtotal) throw new ErroHttp(400, 'O desconto não pode ser maior que o subtotal da venda.');
  return centavos(valor);
}

const textoOpcional = (valor, limite) => (valor ? String(valor).trim().slice(0, limite) || null : null);

export async function registrarVenda(db, corpo, usuario, { formaOpcional = false, observacaoMovimento = null } = {}) {
  const itens = lerItens(corpo?.itens);
  const formaPagamento = lerFormaPagamento(corpo?.forma_pagamento, formaOpcional);
  const cliente = textoOpcional(corpo?.cliente, 120);
  const observacao = textoOpcional(corpo?.observacao, 300);

  return db.transacao(async (tx) => {
    const linhas = [];
    const faltando = [];
    for (const pedido of itens) {
      const item = await tx.um(`SELECT t.* FROM ${pedido.recurso} t WHERE t.id = ?${db.sql.bloquearLinha}`, [pedido.itemId]);
      if (!item) throw new ErroHttp(404, 'Um dos itens da venda não foi encontrado. Atualize a lista e tente de novo.');
      if (item.quantidade < pedido.quantidade) {
        faltando.push(`${item.nome} (há ${item.quantidade}, pedido ${pedido.quantidade})`);
      }
      const preco = pedido.preco ?? item.preco;
      linhas.push({ ...pedido, item, preco, bruto: centavos(preco * pedido.quantidade) });
    }
    if (faltando.length) throw new ErroHttp(400, `Estoque insuficiente: ${faltando.join('; ')}.`);

    const subtotal = centavos(linhas.reduce((soma, l) => soma + l.bruto, 0));
    const desconto = calcularDesconto(corpo?.desconto, subtotal);
    let restante = desconto;
    linhas.forEach((linha, i) => {
      linha.desconto = i === linhas.length - 1 ? centavos(restante) : subtotal ? centavos((desconto * linha.bruto) / subtotal) : 0;
      restante -= linha.desconto;
      linha.total = centavos(linha.bruto - linha.desconto);
    });
    const total = centavos(subtotal - desconto);
    const custoTotal = centavos(linhas.reduce((soma, l) => soma + l.quantidade * (l.item.custo ?? 0), 0));

    const { id } = await tx.um(
      `INSERT INTO vendas (cliente, forma_pagamento, subtotal, desconto, total, custo_total, observacao, usuario_id, usuario_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [cliente, formaPagamento, subtotal, desconto, total, custoTotal, observacao, usuario?.id ?? null, usuario?.nome ?? null]
    );

    for (const linha of linhas) {
      await tx.executar(
        `INSERT INTO venda_itens (venda_id, recurso, item_id, item_nome, quantidade, preco_unitario, desconto, total, custo_unitario)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, linha.recurso, linha.itemId, linha.item.nome, linha.quantidade, linha.preco, linha.desconto, linha.total, linha.item.custo ?? 0]
      );
      await tx.executar(`UPDATE ${linha.recurso} SET quantidade = ? WHERE id = ?`, [linha.item.quantidade - linha.quantidade, linha.itemId]);
      await registrarMovimentacao(tx, {
        recurso: linha.recurso, item: linha.item, operacao: 'saida', motivo: 'Venda', quantidade: linha.quantidade,
        quantidadeAnterior: linha.item.quantidade, precoUnitario: linha.total / linha.quantidade,
        custoUnitario: linha.item.custo ?? 0, observacao: observacaoMovimento ?? `Venda nº ${id}`, usuario, vendaId: id,
      });
    }
    return id;
  });
}

async function buscarVenda(db, id) {
  const venda = await db.um('SELECT * FROM vendas WHERE id = ?', [id]);
  if (!venda) throw new ErroHttp(404, 'Venda não encontrada.');
  venda.itens = await db.consultar('SELECT * FROM venda_itens WHERE venda_id = ? ORDER BY id', [id]);
  return venda;
}

function montarFiltros(db, query) {
  const filtros = [];
  const params = [];
  if (query.busca) {
    const numero = Number(String(query.busca).replace(/\D/g, ''));
    if (Number.isInteger(numero) && numero > 0 && /^\s*(n[ºo°.]?\s*)?\d+\s*$/i.test(query.busca)) {
      filtros.push('(t.id = ? OR t.cliente ' + db.sql.like + ' ?)');
      params.push(numero, `%${query.busca}%`);
    } else {
      filtros.push(`t.cliente ${db.sql.like} ?`);
      params.push(`%${query.busca}%`);
    }
  }
  if (query.situacao) {
    if (!['concluida', 'estornada'].includes(query.situacao)) throw new ErroHttp(400, 'Situação inválida.');
    filtros.push('t.situacao = ?');
    params.push(query.situacao);
  }
  if (query.forma_pagamento) {
    filtros.push('t.forma_pagamento = ?');
    params.push(query.forma_pagamento);
  }
  for (const [chave, sql] of [['de', 't.criado_em >= ?'], ['ate', `t.criado_em < ${db.sql.diaSeguinte('?')}`]]) {
    if (!query[chave]) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query[chave])) throw new ErroHttp(400, 'Data inválida. Use AAAA-MM-DD.');
    filtros.push(sql);
    params.push(query[chave]);
  }
  return { where: filtros.length ? ` WHERE ${filtros.join(' AND ')}` : '', params };
}

export function criarRotasVendas(db, { exigirAdmin }) {
  const router = Router();

  router.get('/catalogo', async (req, res) => {
    const busca = `%${String(req.query.busca ?? '').trim()}%`;
    const partes = TABELAS_ESTOQUE.map(
      (t) => `SELECT '${t}' AS recurso, id, nome, preco, quantidade, imagem FROM ${t} WHERE nome ${db.sql.like} ?`
    );
    const itens = await db.consultar(
      `SELECT * FROM (${partes.join(' UNION ALL ')}) AS catalogo ORDER BY ${db.sql.semCaixa('catalogo.nome')} LIMIT 30`,
      TABELAS_ESTOQUE.map(() => busca)
    );
    res.json(itens);
  });

  router.get('/', async (req, res) => {
    const { where, params } = montarFiltros(db, req.query);
    const paginacao = lerPaginacao(req.query);
    const { total } = await db.um(`SELECT COUNT(*) AS total FROM vendas t${where}`, params);
    const vendas = await db.consultar(
      `SELECT t.*,
              (SELECT COUNT(*) FROM venda_itens vi WHERE vi.venda_id = t.id) AS qtd_itens,
              (SELECT COALESCE(SUM(vi.quantidade), 0) FROM venda_itens vi WHERE vi.venda_id = t.id) AS unidades
       FROM vendas t${where} ORDER BY t.criado_em DESC, t.id DESC${paginacao?.sql ?? ''}`,
      [...params, ...(paginacao?.params ?? [])]
    );
    res.setHeader('X-Total-Count', total);
    res.json(vendas);
  });

  router.post('/', async (req, res) => {
    const id = await registrarVenda(db, req.body, req.usuario);
    res.status(201).json(await buscarVenda(db, id));
  });

  router.get('/:id', async (req, res) => {
    res.json(await buscarVenda(db, lerId(req.params.id)));
  });

  router.post('/:id/estorno', exigirAdmin, async (req, res) => {
    const id = lerId(req.params.id);
    const motivo = textoOpcional(req.body?.motivo, 300);
    await db.transacao(async (tx) => {
      const venda = await tx.um(`SELECT t.* FROM vendas t WHERE t.id = ?${db.sql.bloquearLinha}`, [id]);
      if (!venda) throw new ErroHttp(404, 'Venda não encontrada.');
      if (venda.situacao === 'estornada') throw new ErroHttp(400, 'Esta venda já foi estornada.');
      const itens = await tx.consultar('SELECT * FROM venda_itens WHERE venda_id = ? ORDER BY recurso, item_id', [id]);
      for (const vendido of itens) {
        const item = await tx.um(`SELECT t.* FROM ${vendido.recurso} t WHERE t.id = ?${db.sql.bloquearLinha}`, [vendido.item_id]);
        if (!item) continue;
        await tx.executar(`UPDATE ${vendido.recurso} SET quantidade = ? WHERE id = ?`, [item.quantidade + vendido.quantidade, item.id]);
        await registrarMovimentacao(tx, {
          recurso: vendido.recurso, item, operacao: 'entrada', motivo: 'Estorno de venda', quantidade: vendido.quantidade,
          quantidadeAnterior: item.quantidade, precoUnitario: vendido.total / vendido.quantidade, custoUnitario: vendido.custo_unitario,
          observacao: `Estorno da venda nº ${id}${motivo ? ` · ${motivo}` : ''}`, usuario: req.usuario, vendaId: id,
        });
      }
      await tx.executar(
        `UPDATE vendas SET situacao = 'estornada', motivo_estorno = ?, estornada_em = ${db.sql.agora}, estornada_por = ? WHERE id = ?`,
        [motivo, req.usuario?.nome ?? null, id]
      );
    });
    res.json(await buscarVenda(db, id));
  });

  return router;
}
