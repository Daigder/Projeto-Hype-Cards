import { abrirTrocaSenha } from './sessao.js';

export async function api(caminho, { method = 'GET', body, completo = false } = {}) {
  const arquivo = body instanceof Blob;
  const resposta = await fetch(`/api/${caminho}`, {
    method,
    headers: body ? { 'Content-Type': arquivo ? body.type : 'application/json' } : undefined,
    body: body ? (arquivo ? body : JSON.stringify(body)) : undefined,
  });
  if (resposta.status === 401) {
    location.replace('login.html');
    throw new Error('Sessão encerrada. Faça login novamente.');
  }
  if (resposta.status === 204) return null;
  const dados = await resposta.json();
  if (!resposta.ok) {
    if (dados.trocar_senha) abrirTrocaSenha(true);
    throw new Error(dados.erro || 'Erro inesperado.');
  }
  if (!completo) return dados;
  const total = resposta.headers.get('X-Total-Count');
  return { dados, total: total === null ? null : Number(total) };
}
