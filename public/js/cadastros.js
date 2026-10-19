import { $, criar, moeda, avisar, confirmar, aoMudar, lerPreferencia, salvarPreferencia } from './util.js';
import { api } from './api.js';
import { estado, ehAdmin } from './estado.js';
import { RECURSOS } from './recursos.js';
import { miniatura, badgeEstoque, desenharPaginacao } from './componentes.js';
import { abrirFormulario } from './formulario.js';
import { abrirMovimentacao, abrirHistorico } from './movimentacoes.js';

let lista = { pagina: 1, ordenar: null, direcao: 'asc' };

const recursoAtual = () => RECURSOS[estado.aba];
const visaoAtual = () => (recursoAtual().imagem ? lerPreferencia(`visao-${estado.aba}`, 'tabela') : 'tabela');

function controleEstoque(item) {
  return criar('span', { className: 'estoque' }, [
    criar('button', { className: 'mini', textContent: '−', title: 'Saída de estoque', onclick: () => abrirMovimentacao(estado.aba, item, 'saida') }),
    badgeEstoque(item),
    criar('button', { className: 'mini', textContent: '+', title: 'Entrada de estoque', onclick: () => abrirMovimentacao(estado.aba, item, 'entrada') }),
  ]);
}

function botoesItem(item) {
  const botoes = [];
  if (recursoAtual().estoque) {
    botoes.push(criar('button', { className: 'mini', textContent: 'Histórico', onclick: () => abrirHistorico(estado.aba, item) }));
  }
  if (ehAdmin()) {
    botoes.push(
      criar('button', { className: 'mini', textContent: 'Editar', onclick: () => abrirFormulario(item) }),
      criar('button', { className: 'mini perigo', textContent: 'Excluir', onclick: () => excluir(item) })
    );
  }
  return criar('div', { className: 'botoes-linha' }, botoes);
}

function filtrosLista() {
  const recurso = recursoAtual();
  const params = new URLSearchParams();
  if ($('#busca').value) params.set('busca', $('#busca').value);
  if (recurso.porColecao && $('#filtro-colecao').value) params.set('colecao_id', $('#filtro-colecao').value);
  if (recurso.estoque && $('#filtro-baixo').checked) params.set('estoque_baixo', '1');
  if (lista.ordenar) {
    params.set('ordenar', lista.ordenar);
    params.set('direcao', lista.direcao);
  }
  return params;
}

export async function carregarLista() {
  const recurso = recursoAtual();
  if (!recurso) return;
  const params = filtrosLista();
  $('#btn-exportar').href = `/api/${estado.aba}/exportar.csv?${params}`;
  params.set('pagina', lista.pagina);
  params.set('por_pagina', estado.porPagina);

  const { dados: itens, total } = await api(`${estado.aba}?${params}`, { completo: true });
  if (!itens.length && lista.pagina > 1) {
    lista.pagina -= 1;
    return carregarLista();
  }

  const grade = visaoAtual() === 'grade';
  $('#visao-tabela').hidden = grade;
  $('#visao-grade').hidden = !grade;
  document.querySelectorAll('#alternador-visao button').forEach((b) => b.classList.toggle('ativo', b.dataset.visao === visaoAtual()));
  if (grade) desenharGrade(itens);
  else desenharTabela(recurso, itens);

  $('#vazio').hidden = itens.length > 0;
  desenharPaginacao($('#paginacao'), lista.pagina, total, (pagina) => {
    lista.pagina = pagina;
    carregarLista().catch((e) => avisar(e.message, true));
  });
}

function desenharTabela(recurso, itens) {
  const colunas = [];
  if (recurso.imagem) colunas.push({ titulo: 'Foto' });
  colunas.push(...recurso.colunas.map(([titulo, , chave]) => ({ titulo, chave })));
  if (recurso.estoque) colunas.push({ titulo: 'Estoque', chave: 'quantidade' });
  colunas.push({ titulo: '', classe: 'acoes-linha' });

  $('#cabecalho').replaceChildren(
    criar('tr', {}, colunas.map(({ titulo, chave, classe = '' }) => {
      if (!chave) return criar('th', { textContent: titulo, className: classe });
      const ativa = lista.ordenar === chave;
      const seta = ativa ? (lista.direcao === 'asc' ? ' ▲' : ' ▼') : '';
      return criar('th', { className: `ordenavel${ativa ? ' ativa' : ''}`, title: 'Clique para ordenar' }, [
        criar('button', { type: 'button', textContent: titulo + seta, onclick: () => ordenarPor(chave) }),
      ]);
    }))
  );

  $('#corpo').replaceChildren(
    ...itens.map((item) => {
      const celulas = recurso.colunas.map(([, valor]) => criar('td', { textContent: valor(item) ?? '' }));
      if (recurso.imagem) celulas.unshift(criar('td', { className: 'celula-foto' }, [miniatura(item)]));
      if (recurso.estoque) celulas.push(criar('td', { className: 'celula-estoque' }, [controleEstoque(item)]));
      celulas.push(criar('td', { className: 'acoes-linha' }, [botoesItem(item)]));
      return criar('tr', {}, celulas);
    })
  );
}

function desenharGrade(itens) {
  const recurso = recursoAtual();
  $('#visao-grade').replaceChildren(
    ...itens.map((item) =>
      criar('article', { className: 'cartao-item' }, [
        criar('div', { className: 'cartao-foto' }, [miniatura(item, 'foto-grade')]),
        criar('div', { className: 'cartao-corpo' }, [
          criar('h3', { textContent: item.nome }),
          criar('p', { className: 'cartao-sub', textContent: recurso.subtitulo(item) }),
          criar('div', { className: 'cartao-linha' }, [criar('strong', { textContent: moeda.format(item.preco) }), controleEstoque(item)]),
          botoesItem(item),
        ]),
      ])
    )
  );
}

function ordenarPor(chave) {
  if (lista.ordenar === chave) lista.direcao = lista.direcao === 'asc' ? 'desc' : 'asc';
  else lista = { ...lista, ordenar: chave, direcao: 'asc' };
  lista.pagina = 1;
  carregarLista().catch((e) => avisar(e.message, true));
}

export async function carregarColecoes() {
  estado.colecoes = await api('colecoes');
  const filtro = $('#filtro-colecao');
  const selecionada = filtro.value;
  filtro.replaceChildren(
    criar('option', { value: '', textContent: 'Todas as coleções' }),
    ...estado.colecoes.map((c) => criar('option', { value: c.id, textContent: c.nome }))
  );
  filtro.value = estado.colecoes.some((c) => String(c.id) === selecionada) ? selecionada : '';
}

async function excluir(item) {
  const recurso = recursoAtual();
  const ok = await confirmar(
    `Excluir ${recurso.singular}?`,
    `"${item.nome}" será excluído. Essa ação não pode ser desfeita${recurso.estoque ? ' (o histórico de movimentações é mantido)' : ''}.`,
    'Excluir'
  );
  if (!ok) return;
  try {
    await api(`${estado.aba}/${item.id}`, { method: 'DELETE' });
    avisar('Registro excluído.');
    await carregarLista();
  } catch (erro) {
    avisar(erro.message, true);
  }
}

export async function abrirCadastro() {
  const recurso = recursoAtual();
  lista = { pagina: 1, ordenar: null, direcao: 'asc' };
  $('#titulo-lista').textContent = recurso.titulo;
  $('#busca').value = '';
  $('#filtro-colecao').value = '';
  $('#filtro-baixo').checked = false;
  $('#filtro-colecao').hidden = !recurso.porColecao;
  $('#rotulo-baixo').hidden = !recurso.estoque;
  $('#alternador-visao').hidden = !recurso.imagem;
  $('#btn-exportar').hidden = !recurso.exportar;
  if (recurso.porColecao || estado.aba === 'colecoes') await carregarColecoes();
  await carregarLista();
}

export function iniciarCadastros() {
  $('#btn-novo').addEventListener('click', () => abrirFormulario());
  $('#alternador-visao').addEventListener('click', (e) => {
    if (!e.target.dataset.visao) return;
    salvarPreferencia(`visao-${estado.aba}`, e.target.dataset.visao);
    carregarLista().catch((erro) => avisar(erro.message, true));
  });
  aoMudar(['#busca'], () => { lista.pagina = 1; return carregarLista(); }, ['input']);
  aoMudar(['#filtro-colecao', '#filtro-baixo'], () => { lista.pagina = 1; return carregarLista(); });
}
