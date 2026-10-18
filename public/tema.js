// Tema claro/escuro, compartilhado pela tela de login e pelo sistema.
// Carregado no <head> (sem defer) para aplicar o tema antes de desenhar a página e não "piscar".
(() => {
  const raiz = document.documentElement;
  try {
    const salvo = localStorage.getItem('tema');
    const escuro = salvo ? salvo === 'escuro' : matchMedia('(prefers-color-scheme: dark)').matches;
    raiz.dataset.tema = escuro ? 'escuro' : 'claro';
  } catch {
    raiz.dataset.tema = 'escuro';
  }

  const atualizarBotao = (botao) => {
    const escuro = raiz.dataset.tema === 'escuro';
    botao.textContent = escuro ? '☀️ Claro' : '🌙 Escuro';
    botao.title = escuro ? 'Mudar para o modo claro' : 'Mudar para o modo escuro';
  };

  document.addEventListener('DOMContentLoaded', () => {
    const botao = document.getElementById('btn-tema');
    if (!botao) return;
    atualizarBotao(botao);
    botao.addEventListener('click', () => {
      raiz.dataset.tema = raiz.dataset.tema === 'escuro' ? 'claro' : 'escuro';
      try { localStorage.setItem('tema', raiz.dataset.tema); } catch {}
      atualizarBotao(botao);
    });
  });
})();
