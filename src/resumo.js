import { TABELAS_ESTOQUE } from './db.js';

export async function calcularResumo(db) {
  const totais = (tabela) =>
    db.um(
      `SELECT COUNT(*) AS itens,
              COALESCE(SUM(quantidade), 0) AS unidades,
              COALESCE(SUM(quantidade * preco), 0) AS valor,
              COALESCE(SUM(quantidade * custo), 0) AS custo,
              COALESCE(SUM(CASE WHEN quantidade <= estoque_minimo THEN 1 ELSE 0 END), 0) AS estoque_baixo
       FROM ${tabela}`
    );

  const estoqueBaixo = db.consultar(
    TABELAS_ESTOQUE.map(
      (t) => `SELECT '${t}' AS recurso, id, nome, imagem, quantidade, estoque_minimo FROM ${t} WHERE quantidade <= estoque_minimo`
    ).join(' UNION ALL ') + ' ORDER BY quantidade, nome'
  );

  const doMes = `v.situacao = 'concluida' AND v.criado_em >= ${db.sql.inicioDoMes}`;
  const vendasMes = db.um(
    `SELECT COUNT(*) AS vendas,
            COALESCE((SELECT SUM(vi.quantidade) FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id WHERE ${doMes}), 0) AS unidades,
            COALESCE(SUM(v.total), 0) AS faturamento,
            COALESCE(SUM(v.total - v.custo_total), 0) AS lucro
     FROM vendas v WHERE ${doMes}`
  );

  const maisVendidos = db.consultar(
    `SELECT vi.recurso, vi.item_id, MAX(vi.item_nome) AS nome,
            SUM(vi.quantidade) AS unidades, SUM(vi.total) AS faturamento
     FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id WHERE ${doMes}
     GROUP BY vi.recurso, vi.item_id ORDER BY unidades DESC, faturamento DESC LIMIT 5`
  );

  const [colecoes, cartas, produtos, acessorios, ...resto] = await Promise.all([
    db.um('SELECT COUNT(*) AS total FROM colecoes'),
    ...TABELAS_ESTOQUE.map(totais),
    vendasMes,
    maisVendidos,
    estoqueBaixo,
  ]);
  return { colecoes: colecoes.total, cartas, produtos, acessorios, vendasMes: resto[0], maisVendidos: resto[1], estoqueBaixo: resto[2] };
}
