const form = document.getElementById('form-login');
const erro = document.getElementById('erro-login');

// Já está logado? Vai direto para o sistema.
fetch('/api/auth/eu').then((r) => r.ok && location.replace('/'));

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.usuario || !dados.senha) {
    erro.textContent = 'Informe usuário e senha.';
    return;
  }
  const botao = form.querySelector('button[type="submit"]');
  botao.disabled = true;
  erro.textContent = '';
  try {
    const resposta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    if (resposta.ok) return location.replace('/');
    erro.textContent = (await resposta.json()).erro || 'Não foi possível entrar.';
    form.senha.select();
  } catch {
    erro.textContent = 'Sem conexão com o servidor.';
  } finally {
    botao.disabled = false;
  }
});
