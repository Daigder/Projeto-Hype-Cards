// Listas de valores aceitos nos campos de seleção (também usadas pelo front-end via /api/opcoes)
export const OPCOES = {
  raridades: [
    'Comum',
    'Incomum',
    'Rara',
    'Rara Holo',
    'Double Rare (ex)',
    'Ultra Rare',
    'Illustration Rare',
    'Special Illustration Rare',
    'Hyper Rare (Gold)',
    'Promo',
  ],
  condicoes: [
    'Mint (M)',
    'Near Mint (NM)',
    'Slightly Played (SP)',
    'Moderately Played (MP)',
    'Heavily Played (HP)',
    'Danificada (D)',
  ],
  idiomas: ['Português', 'Inglês', 'Japonês', 'Outro'],
  tiposProduto: [
    'Booster',
    'Booster Display (Box)',
    'Elite Trainer Box',
    'Blister',
    'Lata',
    'Coleção Especial',
    'Deck Pronto',
  ],
  categoriasAcessorio: [
    'Sleeves',
    'Deck Box',
    'Pasta/Binder',
    'Playmat',
    'Toploader',
    'Dados e Marcadores',
    'Outro',
  ],
};

const camposEstoque = {
  preco: { rotulo: 'Preço', tipo: 'numero', padrao: 0 },
  quantidade: { rotulo: 'Quantidade', tipo: 'inteiro', padrao: 0 },
  estoque_minimo: { rotulo: 'Estoque mínimo', tipo: 'inteiro', padrao: 0 },
};

// Cada recurso vira um conjunto de rotas CRUD em /api/<chave>
export const RECURSOS = {
  colecoes: {
    tabela: 'colecoes',
    select: `SELECT t.*,
        (SELECT COUNT(*) FROM cartas WHERE colecao_id = t.id) AS total_cartas,
        (SELECT COUNT(*) FROM produtos WHERE colecao_id = t.id) AS total_produtos
      FROM colecoes t`,
    ordem: 't.data_lancamento DESC, t.nome',
    campos: {
      nome: { rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      sigla: { rotulo: 'Sigla', tipo: 'texto' },
      serie: { rotulo: 'Série', tipo: 'texto' },
      data_lancamento: { rotulo: 'Data de lançamento', tipo: 'data' },
    },
  },
  cartas: {
    tabela: 'cartas',
    select: `SELECT t.*, c.nome AS colecao_nome FROM cartas t
      LEFT JOIN colecoes c ON c.id = t.colecao_id`,
    campos: {
      nome: { rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      colecao_id: { rotulo: 'Coleção', tipo: 'inteiro', obrigatorio: true },
      numero: { rotulo: 'Número', tipo: 'texto' },
      raridade: { rotulo: 'Raridade', tipo: 'texto', opcoes: OPCOES.raridades },
      condicao: { rotulo: 'Condição', tipo: 'texto', opcoes: OPCOES.condicoes, padrao: 'Near Mint (NM)' },
      idioma: { rotulo: 'Idioma', tipo: 'texto', opcoes: OPCOES.idiomas, padrao: 'Português' },
      ...camposEstoque,
    },
  },
  produtos: {
    tabela: 'produtos',
    select: `SELECT t.*, c.nome AS colecao_nome FROM produtos t
      LEFT JOIN colecoes c ON c.id = t.colecao_id`,
    campos: {
      nome: { rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      colecao_id: { rotulo: 'Coleção', tipo: 'inteiro', obrigatorio: true },
      tipo: { rotulo: 'Tipo', tipo: 'texto', obrigatorio: true, opcoes: OPCOES.tiposProduto },
      ...camposEstoque,
    },
  },
  acessorios: {
    tabela: 'acessorios',
    select: 'SELECT t.* FROM acessorios t',
    campos: {
      nome: { rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      categoria: { rotulo: 'Categoria', tipo: 'texto', obrigatorio: true, opcoes: OPCOES.categoriasAcessorio },
      marca: { rotulo: 'Marca', tipo: 'texto' },
      ...camposEstoque,
    },
  },
};
