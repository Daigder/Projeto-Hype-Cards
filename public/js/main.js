import { $, avisar } from './util.js';
import { api } from './api.js';
import { estado, ehAdmin } from './estado.js';
import { RECURSOS } from './recursos.js';
import { abrirResumo } from './resumo.js';
import { abrirCadastro, iniciarCadastros } from './cadastros.js';
import { iniciarFormulario } from './formulario.js';
import { abrirMovimentacoes, iniciarMovimentacoes } from './movimentacoes.js';
import { abrirVender, abrirVendas, iniciarVendas, aoAtualizarVendas } from './vendas.js';
import { abrirRelatorios, iniciarRelatorios } from './relatorios.js';
import { abrirTrocaSenha, iniciarSessao } from './sessao.js';

const SECOES = {
  resumo: { secao: '#secao-resumo', abrir: abrirResumo },
  vender: { secao: '#secao-vender', abrir: abrirVender },
  vendas: { secao: '#secao-vendas', abrir: abrirVendas },
  relatorios: { secao: '#secao-relatorios', abrir: abrirRelatorios },
  movimentacoes: { secao: '#secao-movimentacoes', abrir: abrirMovimentacoes },
};

async function trocarAba(aba) {
  if (RECURSOS[aba]?.soAdmin && !ehAdmin()) aba = 'resumo';
  estado.aba = aba;
  document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
  const especial = SECOES[aba];
  for (const { secao } of Object.values(SECOES)) $(secao).hidden = secao !== especial?.secao;
  $('#secao-lista').hidden = Boolean(especial);
  try {
    await (especial ? especial.abrir() : abrirCadastro());
  } catch (erro) {
    avisar(erro.message, true);
  }
}

let iniciado = false;

async function iniciarSistema() {
  const perfil = estado.usuario.perfil === 'admin' ? 'Administrador' : 'Vendedor';
  $('#nome-usuario').textContent = estado.usuario.nome === perfil ? estado.usuario.nome : `${estado.usuario.nome} · ${perfil}`;
  document.querySelectorAll('[data-admin]').forEach((el) => (el.hidden = !ehAdmin()));
  if (!iniciado) {
    iniciado = true;
    estado.opcoes = await api('opcoes');
    iniciarCadastros();
    iniciarFormulario();
    iniciarMovimentacoes();
    iniciarVendas();
    iniciarRelatorios();
    aoAtualizarVendas(() => trocarAba(estado.aba));
  }
  trocarAba('resumo');
}

document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$('#visualizador').addEventListener('click', () => $('#visualizador').close());
$('#abas').addEventListener('click', (e) => e.target.dataset.aba && trocarAba(e.target.dataset.aba));
$('#btn-nova-venda').addEventListener('click', () => trocarAba('vender'));
iniciarSessao({ aoTrocarSenhaObrigatoria: iniciarSistema });

estado.usuario = await api('auth/eu');
if (estado.usuario.trocar_senha) {
  $('#nome-usuario').textContent = estado.usuario.nome;
  abrirTrocaSenha(true);
} else {
  await iniciarSistema();
}
