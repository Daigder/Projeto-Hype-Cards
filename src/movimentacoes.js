import { Router } from 'express';
import { ErroHttp, lerPaginacao } from './http.js';
import { OPCOES } from './recursos.js';
import { gerarCsv, enviarCsv } from './csv.js';

const NOMES_RECURSO = { cartas: 'Carta', produtos: 'Produto', acessorios: 'Acessório' };

// Lê e valida o corpo de uma entrada/saída. Sem motivo, assume "Ajuste de inventário".
export function validarMovimentacao(corpo, item) {
  const operacao = corpo?.operacao;
  if (operacao !== 'entrada' && operacao !== 'saida') {
    throw new ErroHttp(400, 'A operação deve ser "entrada" ou "saida".');
  }
  const quantidade = Number(corpo?.quantidade);
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new ErroHttp(400, 'A quantidade deve ser um número inteiro maior que zero.');
  }
  const motivos = operacao === 'entrada' ? OPCOES.motivosEntrada : OPCOES.motivosSaida;
  const motivo = String(corpo?.motivo || 'Ajuste de inventário').trim();
  if (!motivos.includes(motivo)) {
    throw new ErroHttp(400, `Motivo inválido para ${operacao === 'entrada' ? 'entrada' : 'saída'}. Use: ${motivos.join(', ')}.`);
  }

  // Venda guarda o preço cobrado; compra guarda o custo pago. Se não vier, usa o do cadastro.
  let precoUnitario = null;
  if (motivo === 'Venda' || motivo === 'Compra') {
    const informado = corpo?.preco_unitario;
    precoUnitario = informado === undefined || informado === null || informado === '' ? null : Number(informado);
    if (precoUnitario === null) precoUnitario = motivo === 'Venda' ? item.preco : item.custo;
    if (!Number.isFinite(precoUnitario) || precoUnitario < 0) {
      throw new ErroHttp(400, 'O valor unitário deve ser um número maior ou igual a zero.');
    }
  }

  const observacao = corpo?.observacao ? String(corpo.observacao).trim().slice(0, 300) : null;
  return {
    operacao, motivo, quantidade, observacao,
    precoUnitario,
    custoUnitario: motivo === 'Compra' ? precoUnitario : item.custo ?? null,
  };
}

export async function registrarMovimentacao(db, {
  recurso, item, operacao, motivo, quantidade, quantidadeAnterior,
  precoUnitario = null, custoUnitario = item.custo ?? null, observacao = null, usuario = null,
}) {
  const quantidadeNova = quantidadeAnterior + (operacao === 'entrada' ? quantidade : -quantidade);
  await db.executar(
    `INSERT INTO movimentacoes (recurso, item_id, item_nome, operacao, motivo, quantidade, quantidade_anterior,
       quantidade_nova, preco_unitario, custo_unitario, observacao, usuario_id, usuario_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [recurso, item.id, item.nome, operacao, motivo, quantidade, quantidadeAnterior, quantidadeNova,
    precoUnitario, custoUnitario, observacao, usuario?.id ?? null, usuario?.nome ?? null]
  );
}

// Filtros: ?busca= (nome do item), ?recurso=cartas, ?operacao=saida, ?motivo=Venda, ?de=2026-01-01, ?ate=2026-01-31
function montarFiltros(db, query) {
  const filtros = [];
  const params = [];
  if (query.busca) {
    filtros.push(`item_nome ${db.sql.like} ?`);
    params.push(`%${query.busca}%`);
  }
  if (query.recurso) {
    if (!NOMES_RECURSO[query.recurso]) throw new ErroHttp(400, 'Tipo de item inválido.');
    filtros.push('recurso = ?');
    params.push(query.recurso);
  }
  if (query.operacao) {
    if (!['entrada', 'saida'].includes(query.operacao)) throw new ErroHttp(400, 'Operação inválida.');
    filtros.push('operacao = ?');
    params.push(query.operacao);
  }
  if (query.motivo) {
    filtros.push('motivo = ?');
    params.push(query.motivo);
  }
  for (const [chave, sql] of [['de', 'criado_em >= ?'], ['ate', `criado_em < ${db.sql.diaSeguinte('?')}`]]) {
    if (!query[chave]) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query[chave])) throw new ErroHttp(400, 'Data inválida. Use AAAA-MM-DD.');
    filtros.push(sql);
    params.push(query[chave]);
  }
  return { where: filtros.length ? ` WHERE ${filtros.join(' AND ')}` : '', params };
}

const COLUNAS_CSV = [
  { chave: 'criado_em', rotulo: 'Data/hora' },
  { chave: 'tipo_item', rotulo: 'Tipo de item' },
  { chave: 'item_nome', rotulo: 'Item' },
  { chave: 'operacao_texto', rotulo: 'Operação' },
  { chave: 'motivo', rotulo: 'Motivo' },
  { chave: 'quantidade', rotulo: 'Quantidade' },
  { chave: 'quantidade_anterior', rotulo: 'Estoque anterior' },
  { chave: 'quantidade_nova', rotulo: 'Estoque após' },
  { chave: 'preco_unitario', rotulo: 'Valor unitário', tipo: 'numero' },
  { chave: 'total', rotulo: 'Valor total', tipo: 'numero' },
  { chave: 'custo_unitario', rotulo: 'Custo unitário', tipo: 'numero' },
  { chave: 'usuario_nome', rotulo: 'Usuário' },
  { chave: 'observacao', rotulo: 'Observação' },
];

export function criarRotasMovimentacoes(db) {
  const router = Router();

  router.get('/', async (req, res) => {
    const { where, params } = montarFiltros(db, req.query);
    const paginacao = lerPaginacao(req.query);
    const { total } = await db.um(`SELECT COUNT(*) AS total FROM movimentacoes${where}`, params);
    const itens = await db.consultar(
      `SELECT * FROM movimentacoes${where} ORDER BY criado_em DESC, id DESC${paginacao?.sql ?? ''}`,
      [...params, ...(paginacao?.params ?? [])]
    );
    res.setHeader('X-Total-Count', total);
    res.json(itens);
  });

  router.get('/exportar.csv', async (req, res) => {
    const { where, params } = montarFiltros(db, req.query);
    const itens = await db.consultar(`SELECT * FROM movimentacoes${where} ORDER BY criado_em DESC, id DESC`, params);
    const linhas = itens.map((m) => ({
      ...m,
      tipo_item: NOMES_RECURSO[m.recurso] ?? m.recurso,
      operacao_texto: m.operacao === 'entrada' ? 'Entrada' : 'Saída',
      total: m.preco_unitario === null ? null : m.preco_unitario * m.quantidade,
    }));
    enviarCsv(res, 'movimentacoes', gerarCsv(linhas, COLUNAS_CSV));
  });

  return router;
}
