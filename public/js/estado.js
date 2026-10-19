import { lerPreferencia } from './util.js';

export const estado = {
  usuario: null,
  opcoes: {},
  colecoes: [],
  aba: 'resumo',
  porPagina: Number(lerPreferencia('porPagina', 20)),
};

export const ehAdmin = () => estado.usuario?.perfil === 'admin';
