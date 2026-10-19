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
  motivosEntrada: ['Compra', 'Devolução de cliente', 'Ajuste de inventário'],
  motivosSaida: ['Venda', 'Avaria/Perda', 'Uso interno', 'Ajuste de inventário'],
  perfis: ['admin', 'vendedor'],
};

const camposEstoque = {
  preco: { rotulo: 'Preço de venda', tipo: 'numero', padrao: 0 },
  custo: { rotulo: 'Preço de custo', tipo: 'numero', padrao: 0 },
  quantidade: { rotulo: 'Quantidade', tipo: 'inteiro', padrao: 0 },
  estoque_minimo: { rotulo: 'Estoque mínimo', tipo: 'inteiro', padrao: 0 },
};

export const RECURSOS = {
  colecoes: {
    tabela: 'colecoes',
    select: `SELECT t.*,
        (SELECT COUNT(*) FROM cartas WHERE colecao_id = t.id) AS total_cartas,
        (SELECT COUNT(*) FROM produtos WHERE colecao_id = t.id) AS total_produtos
      FROM colecoes t`,
    ordem: 't.data_lancamento DESC, t.nome',
    extras: {
      total_cartas: { rotulo: 'Cartas', sql: 'total_cartas' },
      total_produtos: { rotulo: 'Produtos', sql: 'total_produtos' },
    },
    campos: {
      nome: { rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      sigla: { rotulo: 'Sigla', tipo: 'texto' },
      serie: { rotulo: 'Série', tipo: 'texto' },
      data_lancamento: { rotulo: 'Data de lançamento', tipo: 'data' },
    },
  },
  cartas: {
    tabela: 'cartas',
    imagem: true,
    select: `SELECT t.*, c.nome AS colecao_nome FROM cartas t
      LEFT JOIN colecoes c ON c.id = t.colecao_id`,
    extras: { colecao_nome: { rotulo: 'Coleção', sql: 'c.nome', texto: true } },
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
    imagem: true,
    select: `SELECT t.*, c.nome AS colecao_nome FROM produtos t
      LEFT JOIN colecoes c ON c.id = t.colecao_id`,
    extras: { colecao_nome: { rotulo: 'Coleção', sql: 'c.nome', texto: true } },
    campos: {
      nome: { rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      colecao_id: { rotulo: 'Coleção', tipo: 'inteiro', obrigatorio: true },
      tipo: { rotulo: 'Tipo', tipo: 'texto', obrigatorio: true, opcoes: OPCOES.tiposProduto },
      ...camposEstoque,
    },
  },
  acessorios: {
    tabela: 'acessorios',
    imagem: true,
    select: 'SELECT t.* FROM acessorios t',
    campos: {
      nome: { rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      categoria: { rotulo: 'Categoria', tipo: 'texto', obrigatorio: true, opcoes: OPCOES.categoriasAcessorio },
      marca: { rotulo: 'Marca', tipo: 'texto' },
      ...camposEstoque,
    },
  },
};
