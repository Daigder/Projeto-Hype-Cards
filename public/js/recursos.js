import { moeda, formatarData, formatarDataHora } from './util.js';
import { estado } from './estado.js';

const colunaColecao = ['Coleção', (i) => i.colecao_nome, 'colecao_nome'];
const colunaPreco = ['Preço', (i) => moeda.format(i.preco), 'preco'];
const colunaCusto = ['Custo', (i) => moeda.format(i.custo ?? 0), 'custo'];
const camposEstoque = [
  { nome: 'preco', rotulo: 'Preço de venda (R$)', tipo: 'number', passo: '0.01' },
  { nome: 'custo', rotulo: 'Preço de custo (R$)', tipo: 'number', passo: '0.01' },
  { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'number', passo: '1' },
  { nome: 'estoque_minimo', rotulo: 'Estoque mínimo', tipo: 'number', passo: '1' },
];
const campoColecao = { nome: 'colecao_id', rotulo: 'Coleção', opcoes: () => estado.colecoes.map((c) => [c.id, c.nome]), obrigatorio: true };

export const RECURSOS = {
  colecoes: {
    titulo: 'Coleções',
    singular: 'coleção',
    exportar: true,
    colunas: [
      ['Nome', (i) => i.nome, 'nome'],
      ['Sigla', (i) => i.sigla, 'sigla'],
      ['Série', (i) => i.serie, 'serie'],
      ['Lançamento', (i) => formatarData(i.data_lancamento), 'data_lancamento'],
      ['Cartas', (i) => i.total_cartas, 'total_cartas'],
      ['Produtos', (i) => i.total_produtos, 'total_produtos'],
    ],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true },
      { nome: 'sigla', rotulo: 'Sigla' },
      { nome: 'serie', rotulo: 'Série' },
      { nome: 'data_lancamento', rotulo: 'Data de lançamento', tipo: 'date' },
    ],
  },
  cartas: {
    titulo: 'Cartas',
    singular: 'carta',
    categoria: 'Carta',
    imagem: true,
    estoque: true,
    porColecao: true,
    exportar: true,
    subtitulo: (i) => [i.colecao_nome, i.numero, i.raridade].filter(Boolean).join(' · '),
    colunas: [
      ['Nome', (i) => i.nome, 'nome'],
      colunaColecao,
      ['Nº', (i) => i.numero, 'numero'],
      ['Raridade', (i) => i.raridade, 'raridade'],
      ['Condição', (i) => i.condicao, 'condicao'],
      ['Idioma', (i) => i.idioma, 'idioma'],
      colunaPreco,
      colunaCusto,
    ],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true },
      campoColecao,
      { nome: 'numero', rotulo: 'Número (ex.: 025/165)' },
      { nome: 'raridade', rotulo: 'Raridade', opcoes: () => estado.opcoes.raridades },
      { nome: 'condicao', rotulo: 'Condição', opcoes: () => estado.opcoes.condicoes },
      { nome: 'idioma', rotulo: 'Idioma', opcoes: () => estado.opcoes.idiomas },
      ...camposEstoque,
    ],
  },
  produtos: {
    titulo: 'Produtos selados',
    singular: 'produto',
    categoria: 'Produto',
    imagem: true,
    estoque: true,
    porColecao: true,
    exportar: true,
    subtitulo: (i) => [i.tipo, i.colecao_nome].filter(Boolean).join(' · '),
    colunas: [['Nome', (i) => i.nome, 'nome'], colunaColecao, ['Tipo', (i) => i.tipo, 'tipo'], colunaPreco, colunaCusto],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true },
      campoColecao,
      { nome: 'tipo', rotulo: 'Tipo', opcoes: () => estado.opcoes.tiposProduto, obrigatorio: true },
      ...camposEstoque,
    ],
  },
  acessorios: {
    titulo: 'Acessórios',
    singular: 'acessório',
    categoria: 'Acessório',
    imagem: true,
    estoque: true,
    exportar: true,
    subtitulo: (i) => [i.categoria, i.marca].filter(Boolean).join(' · '),
    colunas: [
      ['Nome', (i) => i.nome, 'nome'],
      ['Categoria', (i) => i.categoria, 'categoria'],
      ['Marca', (i) => i.marca, 'marca'],
      colunaPreco,
      colunaCusto,
    ],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true },
      { nome: 'categoria', rotulo: 'Categoria', opcoes: () => estado.opcoes.categoriasAcessorio, obrigatorio: true },
      { nome: 'marca', rotulo: 'Marca' },
      ...camposEstoque,
    ],
  },
  usuarios: {
    titulo: 'Usuários',
    singular: 'usuário',
    soAdmin: true,
    colunas: [
      ['Nome', (i) => i.nome],
      ['Usuário', (i) => i.usuario],
      ['Perfil', (i) => (i.perfil === 'admin' ? 'Administrador' : 'Vendedor')],
      ['Situação', (i) => (i.ativo ? 'Ativo' : 'Inativo')],
      ['Cadastrado em', (i) => formatarDataHora(i.criado_em)],
    ],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true },
      { nome: 'usuario', rotulo: 'Usuário (login)', obrigatorio: true },
      { nome: 'perfil', rotulo: 'Perfil', obrigatorio: true, opcoes: () => [['vendedor', 'Vendedor'], ['admin', 'Administrador']] },
      { nome: 'ativo', rotulo: 'Situação', opcoes: () => [['1', 'Ativo'], ['0', 'Inativo']], valor: (i) => (i ? (i.ativo ? '1' : '0') : '1') },
      {
        nome: 'senha', rotulo: 'Senha inicial (mínimo 6)', rotuloEdicao: 'Nova senha (em branco mantém a atual)',
        tipo: 'password', obrigatorioCriar: true, valor: () => '',
      },
    ],
  },
};

export const nomeCategoria = (recurso) => RECURSOS[recurso]?.categoria ?? recurso;
