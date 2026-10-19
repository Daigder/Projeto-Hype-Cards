import { $, criar, moeda, moedaCompacta, porcentagem, plural, formatarData, avisar, hojeIso } from './util.js';
import { api } from './api.js';
import { nomeCategoria } from './recursos.js';
import { linhaVazia } from './componentes.js';
import { barrasVerticais, barrasHorizontais } from './graficos.js';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
let agrupar = 'mes';

const dois = (n) => String(n).padStart(2, '0');
const isoDe = (data) => `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;

function periodoEscolhido() {
  const hoje = new Date();
  const fim = hojeIso();
  switch ($('#rel-periodo').value) {
    case 'mes': return { de: `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-01`, ate: fim, agrupar: 'dia' };
    case '30d': return { de: isoDe(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29)), ate: fim, agrupar: 'dia' };
    case 'ano': return { de: `${hoje.getFullYear()}-01-01`, ate: fim, agrupar: 'mes' };
    case 'personalizado': return { de: $('#rel-de').value, ate: $('#rel-ate').value || fim, agrupar: null };
    default: return { de: isoDe(new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1)), ate: fim, agrupar: 'mes' };
  }
}

const rotuloPeriodo = (chave) => {
  if (chave.length === 7) return `${MESES[Number(chave.slice(5, 7)) - 1]}/${chave.slice(2, 4)}`;
  return `${chave.slice(8, 10)}/${chave.slice(5, 7)}`;
};

const card = (rotulo, valor, detalhe, classe = '') =>
  criar('div', { className: `card ${classe}` }, [
    criar('div', { className: 'rotulo', textContent: rotulo }),
    criar('div', { className: 'valor', textContent: valor }),
    criar('div', { className: 'detalhe', textContent: detalhe }),
  ]);

function marcarAgrupamento() {
  document.querySelectorAll('#rel-agrupar button').forEach((b) => b.classList.toggle('ativo', b.dataset.agrupar === agrupar));
}

async function carregar() {
  const { de, ate } = periodoEscolhido();
  const params = new URLSearchParams({ agrupar, ate });
  if (de) params.set('de', de);
  const r = await api(`relatorios?${params}`);
  const { totais, estornos } = r;
  const margem = totais.faturamento > 0 ? totais.lucro / totais.faturamento : 0;

  $('#rel-legenda').textContent = `De ${formatarData(r.periodo.de)} até ${formatarData(r.periodo.ate)} · somente vendas concluídas`;
  $('#rel-cards').replaceChildren(
    card('Faturamento', moeda.format(totais.faturamento), plural(totais.vendas, 'venda', 'vendas'), 'destaque'),
    card('Lucro', moeda.format(totais.lucro), `Margem de ${porcentagem.format(margem)}`, 'destaque'),
    card('Ticket médio', moeda.format(totais.ticketMedio), 'valor médio por venda'),
    card('Itens vendidos', totais.unidades, plural(totais.unidades, 'unidade', 'unidades')),
    card('Descontos', moeda.format(totais.descontos), 'concedidos no período'),
    card('Estornos', estornos.quantidade, `${moeda.format(estornos.valor)} devolvidos`),
  );

  barrasVerticais($('#rel-grafico-periodo'), {
    rotulos: r.serie.map((s) => rotuloPeriodo(s.periodo)),
    series: [
      { nome: 'Faturamento', valores: r.serie.map((s) => s.faturamento), classe: 'serie-1' },
      { nome: 'Lucro', valores: r.serie.map((s) => s.lucro), classe: 'serie-2' },
    ],
    formatarEixo: (v) => moedaCompacta.format(v),
    formatar: (v) => moeda.format(v),
    vazio: 'Nenhuma venda concluída neste período.',
  });

  barrasHorizontais($('#rel-grafico-categorias'), {
    itens: r.categorias.map((c) => ({ rotulo: nomeCategoria(c.recurso), valor: c.faturamento, detalhe: `${c.unidades} un.` })),
    formatar: (v) => moeda.format(v),
    vazio: 'Sem vendas no período.',
  });

  barrasHorizontais($('#rel-grafico-pagamentos'), {
    itens: r.pagamentos.map((p) => ({ rotulo: p.forma_pagamento, valor: p.faturamento, detalhe: plural(p.vendas, 'venda', 'vendas') })),
    formatar: (v) => moeda.format(v),
    vazio: 'Sem vendas no período.',
    classe: 'serie-2',
  });

  const linhas = r.maisVendidos.map((item, i) =>
    criar('tr', {}, [
      criar('td', { textContent: i + 1 }),
      criar('td', { textContent: item.nome }),
      criar('td', { textContent: nomeCategoria(item.recurso) }),
      criar('td', { textContent: item.unidades }),
      criar('td', { textContent: moeda.format(item.faturamento) }),
    ])
  );
  $('#rel-top').replaceChildren(...(linhas.length ? linhas : [linhaVazia(5, 'Nenhuma venda no período.')]));
}

export async function abrirRelatorios() {
  marcarAgrupamento();
  await carregar();
}

export function iniciarRelatorios() {
  const recarregar = () => carregar().catch((e) => avisar(e.message, true));
  $('#rel-periodo').addEventListener('change', () => {
    const { agrupar: sugerido } = periodoEscolhido();
    const personalizado = $('#rel-periodo').value === 'personalizado';
    $('#rel-de-rotulo').hidden = !personalizado;
    $('#rel-ate-rotulo').hidden = !personalizado;
    if (sugerido) agrupar = sugerido;
    marcarAgrupamento();
    recarregar();
  });
  for (const id of ['#rel-de', '#rel-ate']) $(id).addEventListener('change', recarregar);
  $('#rel-agrupar').addEventListener('click', (e) => {
    if (!e.target.dataset.agrupar) return;
    agrupar = e.target.dataset.agrupar;
    marcarAgrupamento();
    recarregar();
  });
}
