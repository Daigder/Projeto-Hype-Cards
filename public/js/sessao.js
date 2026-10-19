import { $, criar, avisar } from './util.js';
import { api } from './api.js';
import { estado } from './estado.js';

let senhaObrigatoria = false;
let aoConcluirSenhaObrigatoria = () => {};

export function abrirTrocaSenha(obrigatoria = false) {
  const dialogo = $('#dlg-senha');
  if (dialogo.open) return;
  senhaObrigatoria = obrigatoria;
  $('#form-senha').reset();
  $('#erro-senha').textContent = '';
  $('#aviso-senha').hidden = !obrigatoria;
  $('#btn-cancelar-senha').hidden = obrigatoria;
  dialogo.showModal();
}

export function iniciarSessao({ aoTrocarSenhaObrigatoria }) {
  aoConcluirSenhaObrigatoria = aoTrocarSenhaObrigatoria;
  $('#dlg-senha').addEventListener('cancel', (e) => senhaObrigatoria && e.preventDefault());

  $('#form-senha').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(evento.target));
    if (dados.nova_senha !== dados.confirmacao) {
      $('#erro-senha').textContent = 'As senhas digitadas não são iguais.';
      return;
    }
    try {
      estado.usuario = await api('auth/senha', { method: 'POST', body: { senha_atual: dados.senha_atual, nova_senha: dados.nova_senha } });
      const eraObrigatoria = senhaObrigatoria;
      senhaObrigatoria = false;
      $('#dlg-senha').close();
      avisar('Senha alterada.');
      if (eraObrigatoria) aoConcluirSenhaObrigatoria();
    } catch (erro) {
      $('#erro-senha').textContent = erro.message;
    }
  });

  $('#btn-senha').addEventListener('click', () => abrirTrocaSenha(false));

  $('#btn-sair').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.replace('login.html');
  });

  $('#btn-backup').addEventListener('click', async () => {
    const botao = $('#btn-backup');
    botao.disabled = true;
    try {
      const resposta = await fetch('/api/backup');
      if (!resposta.ok) throw new Error((await resposta.json()).erro || 'Não foi possível gerar o backup.');
      const nome = /filename="([^"]+)"/.exec(resposta.headers.get('Content-Disposition') ?? '')?.[1] ?? 'hypecards-backup.zip';
      const link = criar('a', { href: URL.createObjectURL(await resposta.blob()), download: nome });
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
      avisar('Backup baixado.');
    } catch (erro) {
      avisar(erro.message, true);
    } finally {
      botao.disabled = false;
    }
  });
}
