import { $, criar, salvarPreferencia } from './util.js';
import { estado } from './estado.js';

export const urlImagem = (item) => (item?.imagem ? `/imagens/${encodeURIComponent(item.imagem)}` : null);

export function ampliarImagem(url, nome) {
  $('#imagem-ampliada').src = url;
  $('#imagem-ampliada').alt = nome;
  $('#legenda-imagem').textContent = nome;
  $('#visualizador').showModal();
}

export function miniatura(item, classe = 'miniatura') {
  const url = urlImagem(item);
  if (!url) {
    return criar('span', {
      className: classe === 'miniatura' ? 'sem-foto' : 'sem-foto grande',
      title: 'Sem imagem',
      textContent: classe === 'miniatura' ? '—' : 'Sem imagem',
    });
  }
  return criar('img', {
    className: classe, src: url, alt: item.nome, loading: 'lazy', title: 'Clique para ampliar',
    onclick: () => ampliarImagem(url, item.nome),
  });
}

export function badgeEstoque(item) {
  const baixo = item.quantidade <= item.estoque_minimo;
  return criar('span', { className: `badge${baixo ? ' baixo' : ''}`, textContent: item.quantidade, title: `Mínimo: ${item.estoque_minimo}` });
}

export const etiquetaOperacao = (operacao) =>
  criar('span', { className: `etiqueta ${operacao}`, textContent: operacao === 'entrada' ? '⬆ Entrada' : '⬇ Saída' });

export const etiquetaSituacao = (situacao) =>
  criar('span', { className: `etiqueta ${situacao === 'estornada' ? 'saida' : 'entrada'}`, textContent: situacao === 'estornada' ? 'Estornada' : 'Concluída' });

export const linhaVazia = (colunas, texto) => criar('tr', {}, [criar('td', { colSpan: colunas, className: 'vazio', textContent: texto })]);

export function desenharPaginacao(container, pagina, total, irPara) {
  const porPagina = estado.porPagina;
  if (total === null || total <= Math.min(porPagina, 10)) return container.replaceChildren();
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const inicio = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const fim = Math.min(pagina * porPagina, total);
  const seletor = criar('select', { title: 'Itens por página' },
    [10, 20, 50, 100].map((n) => criar('option', { value: n, textContent: `${n} por página`, selected: n === porPagina })));
  seletor.addEventListener('change', () => {
    estado.porPagina = Number(seletor.value);
    salvarPreferencia('porPagina', estado.porPagina);
    irPara(1);
  });
  container.replaceChildren(
    criar('span', { textContent: `Mostrando ${inicio}–${fim} de ${total}` }),
    criar('div', { className: 'botoes-linha' }, [
      criar('button', { textContent: '‹ Anterior', disabled: pagina <= 1, onclick: () => irPara(pagina - 1) }),
      criar('span', { className: 'pagina-atual', textContent: `${pagina} / ${paginas}` }),
      criar('button', { textContent: 'Próxima ›', disabled: pagina >= paginas, onclick: () => irPara(pagina + 1) }),
    ]),
    seletor
  );
}
