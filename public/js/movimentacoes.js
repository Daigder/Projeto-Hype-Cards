import { $, criar, moeda, avisar, aoMudar, formatarDataHora, numeroVenda } from './util.js';
import { api } from './api.js';
import { estado } from './estado.js';
import { nomeCategoria } from './recursos.js';
import { etiquetaOperacao, desenharPaginacao, linhaVazia } from './componentes.js';
import { carregarLista } from './cadastros.js';
import { abrirVenda } from './vendas.js';

let pagina = 1;
let movimento = { recurso: null, item: null };

const valor = (m) => (m.preco_unitario === null ? '—' : moeda.format(m.preco_unitario));
const total = (m) => (m.preco_unitario === null ? '—' : moeda.format(m.preco_unitario * m.quantidade));

function celulaMotivo(m) {
  if (!m.venda_id) return criar('td', { textContent: m.motivo, title: m.observacao ?? '' });
  return criar('td', {}, [
    m.motivo,
    criar('button', { type: 'button', className: 'link-venda', textContent: `Venda ${numeroVenda(m.venda_id)}`, onclick: () => abrirVenda(m.venda_id) }),
  ]);
}

function filtros() {
  const params = new URLSearchParams();
  const campos = { busca: '#mov-busca', recurso: '#mov-recurso', operacao: '#mov-operacao', motivo: '#mov-motivo', de: '#mov-de', ate: '#mov-ate' };
  for (const [nome, seletor] of Object.entries(campos)) {
    if ($(seletor).value) params.set(nome, $(seletor).value);
  }
  return params;
}

async function carregar() {
  const params = filtros();
  $('#btn-exportar-mov').href = `/api/movimentacoes/exportar.csv?${params}`;
  params.set('pagina', pagina);
  params.set('por_pagina', estado.porPagina);
  const { dados: itens, total: quantidade } = await api(`movimentacoes?${params}`, { completo: true });

  $('#corpo-mov').replaceChildren(
    ...itens.map((m) =>
      criar('tr', {}, [
        criar('td', { className: 'sem-quebra', textContent: formatarDataHora(m.criado_em) }),
        criar('td', {}, [m.item_nome, criar('small', { className: 'tipo-item', textContent: nomeCategoria(m.recurso) })]),
        criar('td', {}, [etiquetaOperacao(m.operacao)]),
        celulaMotivo(m),
        criar('td', { textContent: m.quantidade }),
        criar('td', { className: 'sem-quebra', textContent: `${m.quantidade_anterior} → ${m.quantidade_nova}` }),
        criar('td', { textContent: valor(m) }),
        criar('td', { textContent: total(m) }),
        criar('td', { textContent: m.usuario_nome ?? '—' }),
        criar('td', { className: 'observacao', textContent: m.observacao ?? '' }),
      ])
    )
  );
  $('#vazio-mov').hidden = itens.length > 0;
  desenharPaginacao($('#paginacao-mov'), pagina, quantidade, (nova) => {
    pagina = nova;
    carregar().catch((e) => avisar(e.message, true));
  });
}

export async function abrirMovimentacoes() {
  pagina = 1;
  await carregar();
}

export async function abrirHistorico(recurso, item) {
  try {
    const historico = await api(`${recurso}/${item.id}/movimentacoes`);
    $('#titulo-historico').textContent = `Histórico — ${item.nome}`;
    $('#corpo-historico').replaceChildren(
      ...(historico.length
        ? historico.map((m) =>
            criar('tr', {}, [
              criar('td', { className: 'sem-quebra', textContent: formatarDataHora(m.criado_em) }),
              criar('td', {}, [etiquetaOperacao(m.operacao)]),
              celulaMotivo(m),
              criar('td', { textContent: m.quantidade }),
              criar('td', { className: 'sem-quebra', textContent: `${m.quantidade_anterior} → ${m.quantidade_nova}` }),
              criar('td', { textContent: valor(m) }),
              criar('td', { textContent: m.usuario_nome ?? '—' }),
            ])
          )
        : [linhaVazia(7, 'Nenhuma movimentação registrada.')])
    );
    $('#dlg-historico').showModal();
  } catch (erro) {
    avisar(erro.message, true);
  }
}

const formMov = () => $('#form-movimentar');

export function abrirMovimentacao(recurso, item, operacao) {
  movimento = { recurso, item };
  const form = formMov();
  form.reset();
  form.operacao.value = operacao;
  $('#mov-item-nome').textContent = item.nome;
  $('#mov-item-estoque').textContent = `— ${item.quantidade} em estoque`;
  $('#erro-movimentar').textContent = '';
  atualizar(true);
  $('#dlg-movimentar').showModal();
  form.quantidade.select();
}

function atualizar(trocouOperacao = false) {
  const form = formMov();
  const { item } = movimento;
  const operacao = form.operacao.value;
  if (trocouOperacao) {
    const motivos = operacao === 'entrada' ? estado.opcoes.motivosEntrada : estado.opcoes.motivosSaida;
    $('#mov-form-motivo').replaceChildren(...motivos.map((m) => criar('option', { value: m, textContent: m })));
    form.motivo.value = operacao === 'entrada' ? 'Compra' : 'Venda';
  }
  const motivo = form.motivo.value;
  const comValor = motivo === 'Venda' || motivo === 'Compra';
  $('#rotulo-valor-unitario').hidden = !comValor;
  $('#rotulo-pagamento').hidden = motivo !== 'Venda';
  if (comValor && (trocouOperacao || form.dataset.motivoAnterior !== motivo)) {
    $('#texto-valor-unitario').textContent = motivo === 'Venda' ? 'Preço de venda unitário (R$)' : 'Custo unitário pago (R$)';
    form.preco_unitario.value = motivo === 'Venda' ? item.preco : item.custo ?? 0;
  }
  form.dataset.motivoAnterior = motivo;

  const quantidade = Math.max(0, Math.trunc(Number(form.quantidade.value) || 0));
  const nova = item.quantidade + (operacao === 'entrada' ? quantidade : -quantidade);
  let texto = `Estoque: ${item.quantidade} → ${nova}`;
  if (comValor && quantidade) texto += ` · Total: ${moeda.format(quantidade * Number(form.preco_unitario.value || 0))}`;
  $('#previa-movimento').textContent = texto;
  $('#previa-movimento').classList.toggle('negativo', nova < 0);
}

export function iniciarMovimentacoes() {
  $('#mov-form-pagamento').replaceChildren(...estado.opcoes.formasPagamento.map((f) => criar('option', { value: f, textContent: f })));
  const motivos = [...new Set([...estado.opcoes.motivosSistema, ...estado.opcoes.motivosEntrada, ...estado.opcoes.motivosSaida])];
  $('#mov-motivo').replaceChildren(
    criar('option', { value: '', textContent: 'Todos os motivos' }),
    ...motivos.map((m) => criar('option', { value: m, textContent: m }))
  );

  const form = formMov();
  form.addEventListener('change', (e) => atualizar(e.target.name === 'operacao'));
  form.addEventListener('input', () => atualizar());
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(form));
    if ($('#rotulo-valor-unitario').hidden) delete dados.preco_unitario;
    if ($('#rotulo-pagamento').hidden) delete dados.forma_pagamento;
    try {
      await api(`${movimento.recurso}/${movimento.item.id}/estoque`, { method: 'PATCH', body: dados });
      $('#dlg-movimentar').close();
      avisar(`${dados.operacao === 'entrada' ? 'Entrada' : 'Saída'} registrada: ${dados.motivo}.`);
      await carregarLista();
    } catch (erro) {
      $('#erro-movimentar').textContent = erro.message;
    }
  });

  aoMudar(['#mov-busca'], () => { pagina = 1; return carregar(); }, ['input']);
  aoMudar(['#mov-recurso', '#mov-operacao', '#mov-motivo', '#mov-de', '#mov-ate'], () => { pagina = 1; return carregar(); });
}
