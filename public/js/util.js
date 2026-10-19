export const $ = (seletor) => document.querySelector(seletor);

export const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const moedaCompacta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
export const porcentagem = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export const formatarData = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
export const formatarDataHora = (texto) => {
  if (!texto) return '';
  const [data, hora = ''] = String(texto).replace('T', ' ').split(' ');
  return `${formatarData(data)} ${hora.slice(0, 5)}`.trim();
};
export const numeroVenda = (id) => `nº ${String(id).padStart(6, '0')}`;
export const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;

export const lerPreferencia = (chave, padrao) => {
  try { return localStorage.getItem(chave) ?? padrao; } catch { return padrao; }
};
export const salvarPreferencia = (chave, valor) => {
  try { localStorage.setItem(chave, valor); } catch {}
};

export function criar(tag, propriedades = {}, filhos = []) {
  const el = Object.assign(document.createElement(tag), propriedades);
  el.append(...filhos);
  return el;
}

export function criarSvg(tag, atributos = {}, filhos = []) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [nome, valor] of Object.entries(atributos)) el.setAttribute(nome, valor);
  el.append(...filhos);
  return el;
}

export function avisar(mensagem, falha = false) {
  const aviso = $('#aviso');
  aviso.textContent = mensagem;
  aviso.classList.toggle('falha', falha);
  aviso.hidden = false;
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => (aviso.hidden = true), 3500);
}

export function confirmar(titulo, mensagem, textoOk = 'Confirmar') {
  const dialogo = $('#dlg-confirmar');
  $('#confirmar-titulo').textContent = titulo;
  $('#confirmar-mensagem').textContent = mensagem;
  $('#confirmar-ok').textContent = textoOk;
  dialogo.returnValue = '';
  dialogo.showModal();
  return new Promise((ok) => dialogo.addEventListener('close', () => ok(dialogo.returnValue === 'sim'), { once: true }));
}

export function aoMudar(seletores, acao, eventos = ['change']) {
  let atraso;
  for (const seletor of seletores) {
    for (const evento of eventos) {
      $(seletor).addEventListener(evento, () => {
        clearTimeout(atraso);
        atraso = setTimeout(() => acao().catch((e) => avisar(e.message, true)), evento === 'input' ? 250 : 0);
      });
    }
  }
}

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
