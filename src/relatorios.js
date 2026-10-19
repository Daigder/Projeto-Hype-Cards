import { Router } from 'express';
import { ErroHttp } from './http.js';

const MAX_DIAS_POR_DIA = 92;
const dois = (n) => String(n).padStart(2, '0');
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

function lerPeriodo(query) {
  const fim = query.ate || hoje();
  let inicio = query.de;
  if (!inicio) {
    const [ano, mes] = fim.split('-').map(Number);
    const total = ano * 12 + (mes - 1) - 11;
    inicio = `${Math.floor(total / 12)}-${dois((total % 12) + 1)}-01`;
  }
  for (const data of [inicio, fim]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) {
      throw new ErroHttp(400, 'Data inválida. Use AAAA-MM-DD.');
    }
  }
  if (inicio > fim) throw new ErroHttp(400, 'A data inicial deve ser anterior à data final.');
  const agrupar = query.agrupar === 'dia' ? 'dia' : 'mes';
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 864e5 + 1;
  if (agrupar === 'dia' && dias > MAX_DIAS_POR_DIA) {
    throw new ErroHttp(400, `Para agrupar por dia, escolha um período de até ${MAX_DIAS_POR_DIA} dias.`);
  }
  return { inicio, fim, agrupar };
}

function periodosEntre(inicio, fim, agrupar) {
  const chaves = [];
  if (agrupar === 'dia') {
    for (let t = Date.parse(inicio); t <= Date.parse(fim); t += 864e5) chaves.push(new Date(t).toISOString().slice(0, 10));
    return chaves;
  }
  let [ano, mes] = inicio.split('-').map(Number);
  const [anoFim, mesFim] = fim.split('-').map(Number);
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    chaves.push(`${ano}-${dois(mes)}`);
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return chaves;
}

export function criarRotasRelatorios(db) {
  const router = Router();

  router.get('/', async (req, res) => {
    const { inicio, fim, agrupar } = lerPeriodo(req.query);
    const noPeriodo = `v.criado_em >= ? AND v.criado_em < ${db.sql.diaSeguinte('?')}`;
    const params = [inicio, fim];
    const concluidas = `v.situacao = 'concluida' AND ${noPeriodo}`;
    const chave = agrupar === 'dia' ? db.sql.chaveDia('v.criado_em') : db.sql.chaveMes('v.criado_em');

    const [totais, unidades, estornos, serie, categorias, pagamentos, maisVendidos] = await Promise.all([
      db.um(
        `SELECT COUNT(*) AS vendas, COALESCE(SUM(v.total), 0) AS faturamento, COALESCE(SUM(v.custo_total), 0) AS custo,
                COALESCE(SUM(v.desconto), 0) AS descontos
         FROM vendas v WHERE ${concluidas}`,
        params
      ),
      db.um(`SELECT COALESCE(SUM(vi.quantidade), 0) AS total FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id WHERE ${concluidas}`, params),
      db.um(`SELECT COUNT(*) AS quantidade, COALESCE(SUM(v.total), 0) AS valor FROM vendas v WHERE v.situacao = 'estornada' AND ${noPeriodo}`, params),
      db.consultar(
        `SELECT ${chave} AS periodo, COUNT(*) AS vendas, COALESCE(SUM(v.total), 0) AS faturamento, COALESCE(SUM(v.custo_total), 0) AS custo
         FROM vendas v WHERE ${concluidas} GROUP BY ${chave} ORDER BY ${chave}`,
        params
      ),
      db.consultar(
        `SELECT vi.recurso, SUM(vi.quantidade) AS unidades, SUM(vi.total) AS faturamento, SUM(vi.quantidade * vi.custo_unitario) AS custo
         FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id WHERE ${concluidas}
         GROUP BY vi.recurso ORDER BY faturamento DESC`,
        params
      ),
      db.consultar(
        `SELECT v.forma_pagamento, COUNT(*) AS vendas, SUM(v.total) AS faturamento
         FROM vendas v WHERE ${concluidas} GROUP BY v.forma_pagamento ORDER BY faturamento DESC`,
        params
      ),
      db.consultar(
        `SELECT vi.recurso, vi.item_id, MAX(vi.item_nome) AS nome, SUM(vi.quantidade) AS unidades, SUM(vi.total) AS faturamento
         FROM venda_itens vi JOIN vendas v ON v.id = vi.venda_id WHERE ${concluidas}
         GROUP BY vi.recurso, vi.item_id ORDER BY faturamento DESC, unidades DESC LIMIT 10`,
        params
      ),
    ]);

    const porPeriodo = new Map(serie.map((s) => [s.periodo, s]));
    const lucro = (linha) => linha.faturamento - linha.custo;
    res.json({
      periodo: { de: inicio, ate: fim, agrupar },
      totais: {
        vendas: totais.vendas,
        faturamento: totais.faturamento,
        lucro: lucro(totais),
        descontos: totais.descontos,
        unidades: unidades.total,
        ticketMedio: totais.vendas ? totais.faturamento / totais.vendas : 0,
      },
      estornos,
      serie: periodosEntre(inicio, fim, agrupar).map((periodo) => {
        const s = porPeriodo.get(periodo) ?? { vendas: 0, faturamento: 0, custo: 0 };
        return { periodo, vendas: s.vendas, faturamento: s.faturamento, lucro: lucro(s) };
      }),
      categorias: categorias.map((c) => ({ recurso: c.recurso, unidades: c.unidades, faturamento: c.faturamento, lucro: lucro(c) })),
      pagamentos,
      maisVendidos,
    });
  });

  return router;
}
