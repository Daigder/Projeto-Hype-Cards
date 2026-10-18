// Utilitários comuns às rotas da API

const MAX_POR_PAGINA = 100;

export class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export function lerId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErroHttp(400, 'ID inválido.');
  return id;
}

// ?pagina=2&por_pagina=20 → LIMIT/OFFSET. Sem "pagina", devolve todos os registros.
export function lerPaginacao(query) {
  if (query.pagina === undefined) return null;
  const pagina = Number(query.pagina);
  const porPagina = Number(query.por_pagina ?? 20);
  if (!Number.isInteger(pagina) || pagina < 1) throw new ErroHttp(400, 'Página inválida.');
  if (!Number.isInteger(porPagina) || porPagina < 1 || porPagina > MAX_POR_PAGINA) {
    throw new ErroHttp(400, `Itens por página deve ser de 1 a ${MAX_POR_PAGINA}.`);
  }
  return { sql: ' LIMIT ? OFFSET ?', params: [porPagina, (pagina - 1) * porPagina] };
}
