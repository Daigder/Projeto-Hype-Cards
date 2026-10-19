const $ = (seletor) => document.querySelector(seletor);
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const porcentagem = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
const formatarData = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const formatarDataHora = (texto) => {
  if (!texto) return '';
  const [data, hora = ''] = texto.split(' ');
  return `${formatarData(data)} ${hora.slice(0, 5)}`;
};

const plural = (n, singular, pluralTexto) => `${n} ${n === 1 ? singular : pluralTexto}`;

const lerPreferencia = (chave, padrao) => {
  try { return localStorage.getItem(chave) ?? padrao; } catch { return padrao; }
};
const salvarPreferencia = (chave, valor) => {
  try { localStorage.setItem(chave, valor); } catch {}
};

async function api(caminho, { method = 'GET', body, completo = false } = {}) {
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

let usuario = null;
let opcoes = {};
let colecoes = [];
let abaAtual = 'resumo';
let editandoId = null;
let imagemForm = { arquivo: null, remover: false };
let lista = { pagina: 1, ordenar: null, direcao: 'asc' };
let paginaMov = 1;
let porPagina = Number(lerPreferencia('porPagina', 20));

const ehAdmin = () => usuario?.perfil === 'admin';

const TIPOS_IMAGEM = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const TAMANHO_MAX_ORIGINAL = 20 * 1024 * 1024;
const TAMANHO_MAX_ENVIO = 5 * 1024 * 1024;
const LADO_MAX_IMAGEM = 1000;
const urlImagem = (item) => (item?.imagem ? `/imagens/${encodeURIComponent(item.imagem)}` : null);

const colunaColecao = ['Coleção', (i) => i.colecao_nome, 'colecao_nome'];
const colunaPreco = ['Preço', (i) => moeda.format(i.preco), 'preco'];
const colunaCusto = ['Custo', (i) => moeda.format(i.custo ?? 0), 'custo'];
const camposEstoque = [
  { nome: 'preco', rotulo: 'Preço de venda (R$)', tipo: 'number', passo: '0.01' },
  { nome: 'custo', rotulo: 'Preço de custo (R$)', tipo: 'number', passo: '0.01' },
  { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'number', passo: '1' },
  { nome: 'estoque_minimo', rotulo: 'Estoque mínimo', tipo: 'number', passo: '1' },
];
const campoColecao = { nome: 'colecao_id', rotulo: 'Coleção', opcoes: () => colecoes.map((c) => [c.id, c.nome]), obrigatorio: true };

const RECURSOS = {
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
      { nome: 'raridade', rotulo: 'Raridade', opcoes: () => opcoes.raridades },
      { nome: 'condicao', rotulo: 'Condição', opcoes: () => opcoes.condicoes },
      { nome: 'idioma', rotulo: 'Idioma', opcoes: () => opcoes.idiomas },
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
      { nome: 'tipo', rotulo: 'Tipo', opcoes: () => opcoes.tiposProduto, obrigatorio: true },
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
      { nome: 'categoria', rotulo: 'Categoria', opcoes: () => opcoes.categoriasAcessorio, obrigatorio: true },
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

function avisar(mensagem, falha = false) {
  const aviso = $('#aviso');
  aviso.textContent = mensagem;
  aviso.classList.toggle('falha', falha);
  aviso.hidden = false;
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => (aviso.hidden = true), 3500);
}

function criar(tag, propriedades = {}, filhos = []) {
  const el = Object.assign(document.createElement(tag), propriedades);
  el.append(...filhos);
  return el;
}

function confirmar(titulo, mensagem, textoOk = 'Confirmar') {
  const dialogo = $('#dlg-confirmar');
  $('#confirmar-titulo').textContent = titulo;
  $('#confirmar-mensagem').textContent = mensagem;
  $('#confirmar-ok').textContent = textoOk;
  dialogo.returnValue = '';
  dialogo.showModal();
  return new Promise((ok) => dialogo.addEventListener('close', () => ok(dialogo.returnValue === 'sim'), { once: true }));
}

function badgeEstoque(item) {
  const baixo = item.quantidade <= item.estoque_minimo;
  return criar('span', {
    className: `badge${baixo ? ' baixo' : ''}`,
    textContent: item.quantidade,
    title: `Mínimo: ${item.estoque_minimo}`,
  });
}

function controleEstoque(item) {
  return criar('span', { className: 'estoque' }, [
    criar('button', { className: 'mini', textContent: '−', title: 'Saída de estoque', onclick: () => abrirMovimentacao(item, 'saida') }),
    badgeEstoque(item),
    criar('button', { className: 'mini', textContent: '+', title: 'Entrada de estoque', onclick: () => abrirMovimentacao(item, 'entrada') }),
  ]);
}

function botoesItem(item) {
  const recurso = RECURSOS[abaAtual];
  const botoes = [];
  if (recurso.estoque) {
    botoes.push(criar('button', { className: 'mini', textContent: 'Histórico', onclick: () => abrirHistorico(item) }));
  }
  if (ehAdmin()) {
    botoes.push(
      criar('button', { className: 'mini', textContent: 'Editar', onclick: () => abrirFormulario(item) }),
      criar('button', { className: 'mini perigo', textContent: 'Excluir', onclick: () => excluir(item) })
    );
  }
  return criar('div', { className: 'botoes-linha' }, botoes);
}

function miniatura(item, classe = 'miniatura') {
  const url = urlImagem(item);
  if (!url) return criar('span', { className: classe === 'miniatura' ? 'sem-foto' : 'sem-foto grande', title: 'Sem imagem', textContent: classe === 'miniatura' ? '—' : 'Sem imagem' });
  return criar('img', {
    className: classe, src: url, alt: item.nome, loading: 'lazy', title: 'Clique para ampliar',
    onclick: () => ampliarImagem(url, item.nome),
  });
}

function ampliarImagem(url, nome) {
  $('#imagem-ampliada').src = url;
  $('#imagem-ampliada').alt = nome;
  $('#legenda-imagem').textContent = nome;
  $('#visualizador').showModal();
}

function desenharPaginacao(container, pagina, total, irPara) {
  if (total === null || total <= Math.min(porPagina, 10)) return container.replaceChildren();
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const inicio = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const fim = Math.min(pagina * porPagina, total);
  const seletor = criar('select', { title: 'Itens por página' },
    [10, 20, 50, 100].map((n) => criar('option', { value: n, textContent: `${n} por página`, selected: n === porPagina })));
  seletor.addEventListener('change', () => {
    porPagina = Number(seletor.value);
    salvarPreferencia('porPagina', porPagina);
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

async function carregarResumo() {
  const r = await api('resumo');
  const categorias = [r.cartas, r.produtos, r.acessorios];
  const soma = (campo) => categorias.reduce((total, c) => total + c[campo], 0);
  const valor = soma('valor');
  const custo = soma('custo');
  const { vendasMes } = r;
  const margem = vendasMes.faturamento > 0 ? vendasMes.lucro / vendasMes.faturamento : 0;

  const card = (rotulo, valorTexto, detalhe, classe = '') =>
    criar('div', { className: `card ${classe}` }, [
      criar('div', { className: 'rotulo', textContent: rotulo }),
      criar('div', { className: 'valor', textContent: valorTexto }),
      criar('div', { className: 'detalhe', textContent: detalhe }),
    ]);
  const detalhe = (t) => `${plural(t.itens, 'item', 'itens')} · ${t.estoque_baixo} com estoque baixo`;

  $('#cards-resumo').replaceChildren(
    card('Vendas no mês', moeda.format(vendasMes.faturamento), `${plural(vendasMes.unidades, 'unidade', 'unidades')} em ${plural(vendasMes.vendas, 'venda', 'vendas')}`, 'destaque'),
    card('Lucro no mês', moeda.format(vendasMes.lucro), `Margem de ${porcentagem.format(margem)}`, 'destaque'),
    card('Valor em estoque', moeda.format(valor), `${plural(soma('unidades'), 'unidade', 'unidades')} pelo preço de venda`),
    card('Custo do estoque', moeda.format(custo), `Lucro potencial: ${moeda.format(valor - custo)}`),
    card('Coleções', r.colecoes, 'cadastradas'),
    card('Cartas', r.cartas.unidades, detalhe(r.cartas)),
    card('Produtos selados', r.produtos.unidades, detalhe(r.produtos)),
    card('Acessórios', r.acessorios.unidades, detalhe(r.acessorios)),
  );

  const linhaVazia = (colunas, texto) => criar('tr', {}, [criar('td', { colSpan: colunas, className: 'vazio', textContent: texto })]);

  const vendidos = r.maisVendidos.map((i) =>
    criar('tr', {}, [
      criar('td', { textContent: i.nome }),
      criar('td', { textContent: RECURSOS[i.recurso]?.categoria ?? i.recurso }),
      criar('td', { textContent: i.unidades }),
      criar('td', { textContent: moeda.format(i.faturamento) }),
    ])
  );
  $('#tabela-vendidos').replaceChildren(...(vendidos.length ? vendidos : [linhaVazia(4, 'Nenhuma venda registrada neste mês.')]));

  const baixos = r.estoqueBaixo.map((i) =>
    criar('tr', {}, [
      criar('td', { className: 'celula-foto' }, [miniatura(i)]),
      criar('td', { textContent: i.nome }),
      criar('td', { textContent: RECURSOS[i.recurso].categoria }),
      criar('td', {}, [criar('span', { className: 'badge baixo', textContent: i.quantidade })]),
      criar('td', { textContent: i.estoque_minimo }),
    ])
  );
  $('#tabela-baixo').replaceChildren(...(baixos.length ? baixos : [linhaVazia(5, 'Tudo certo! Nenhum item abaixo do mínimo.')]));
}

function filtrosLista() {
  const recurso = RECURSOS[abaAtual];
  const params = new URLSearchParams();
  if ($('#busca').value) params.set('busca', $('#busca').value);
  if (recurso.porColecao && $('#filtro-colecao').value) params.set('colecao_id', $('#filtro-colecao').value);
  if (recurso.estoque && $('#filtro-baixo').checked) params.set('estoque_baixo', '1');
  if (lista.ordenar) {
    params.set('ordenar', lista.ordenar);
    params.set('direcao', lista.direcao);
  }
  return params;
}

const visaoAtual = () => (RECURSOS[abaAtual].imagem ? lerPreferencia(`visao-${abaAtual}`, 'tabela') : 'tabela');

async function carregarLista() {
  const recurso = RECURSOS[abaAtual];
  const params = filtrosLista();
  $('#btn-exportar').href = `/api/${abaAtual}/exportar.csv?${params}`;
  params.set('pagina', lista.pagina);
  params.set('por_pagina', porPagina);

  const { dados: itens, total } = await api(`${abaAtual}?${params}`, { completo: true });
  if (!itens.length && lista.pagina > 1) {
    lista.pagina -= 1;
    return carregarLista();
  }

  const grade = visaoAtual() === 'grade';
  $('#visao-tabela').hidden = grade;
  $('#visao-grade').hidden = !grade;
  document.querySelectorAll('#alternador-visao button').forEach((b) => b.classList.toggle('ativo', b.dataset.visao === visaoAtual()));
  if (grade) desenharGrade(itens);
  else desenharTabela(recurso, itens);

  $('#vazio').hidden = itens.length > 0;
  desenharPaginacao($('#paginacao'), lista.pagina, total, (pagina) => {
    lista.pagina = pagina;
    carregarLista().catch((e) => avisar(e.message, true));
  });
}

function desenharTabela(recurso, itens) {
  const colunas = [];
  if (recurso.imagem) colunas.push({ titulo: 'Foto' });
  colunas.push(...recurso.colunas.map(([titulo, , chave]) => ({ titulo, chave })));
  if (recurso.estoque) colunas.push({ titulo: 'Estoque', chave: 'quantidade' });
  colunas.push({ titulo: '', classe: 'acoes-linha' });

  $('#cabecalho').replaceChildren(
    criar('tr', {}, colunas.map(({ titulo, chave, classe = '' }) => {
      if (!chave) return criar('th', { textContent: titulo, className: classe });
      const ativa = lista.ordenar === chave;
      const seta = ativa ? (lista.direcao === 'asc' ? ' ▲' : ' ▼') : '';
      return criar('th', { className: `ordenavel${ativa ? ' ativa' : ''}`, title: 'Clique para ordenar' }, [
        criar('button', { type: 'button', textContent: titulo + seta, onclick: () => ordenarPor(chave) }),
      ]);
    }))
  );

  $('#corpo').replaceChildren(
    ...itens.map((item) => {
      const celulas = recurso.colunas.map(([, valor]) => criar('td', { textContent: valor(item) ?? '' }));
      if (recurso.imagem) celulas.unshift(criar('td', { className: 'celula-foto' }, [miniatura(item)]));
      if (recurso.estoque) celulas.push(criar('td', { className: 'celula-estoque' }, [controleEstoque(item)]));
      celulas.push(criar('td', { className: 'acoes-linha' }, [botoesItem(item)]));
      return criar('tr', {}, celulas);
    })
  );
}

function desenharGrade(itens) {
  const recurso = RECURSOS[abaAtual];
  $('#visao-grade').replaceChildren(
    ...itens.map((item) =>
      criar('article', { className: 'cartao-item' }, [
        criar('div', { className: 'cartao-foto' }, [miniatura(item, 'foto-grade')]),
        criar('div', { className: 'cartao-corpo' }, [
          criar('h3', { textContent: item.nome }),
          criar('p', { className: 'cartao-sub', textContent: recurso.subtitulo(item) }),
          criar('div', { className: 'cartao-linha' }, [
            criar('strong', { textContent: moeda.format(item.preco) }),
            controleEstoque(item),
          ]),
          botoesItem(item),
        ]),
      ])
    )
  );
}

function ordenarPor(chave) {
  if (lista.ordenar === chave) lista.direcao = lista.direcao === 'asc' ? 'desc' : 'asc';
  else lista = { ...lista, ordenar: chave, direcao: 'asc' };
  lista.pagina = 1;
  carregarLista().catch((e) => avisar(e.message, true));
}

async function carregarColecoes() {
  colecoes = await api('colecoes');
  const filtro = $('#filtro-colecao');
  const selecionada = filtro.value;
  filtro.replaceChildren(
    criar('option', { value: '', textContent: 'Todas as coleções' }),
    ...colecoes.map((c) => criar('option', { value: c.id, textContent: c.nome }))
  );
  filtro.value = colecoes.some((c) => String(c.id) === selecionada) ? selecionada : '';
}

function filtrosMovimentacoes() {
  const params = new URLSearchParams();
  const campos = { busca: '#mov-busca', recurso: '#mov-recurso', operacao: '#mov-operacao', motivo: '#mov-motivo', de: '#mov-de', ate: '#mov-ate' };
  for (const [nome, seletor] of Object.entries(campos)) {
    if ($(seletor).value) params.set(nome, $(seletor).value);
  }
  return params;
}

function preencherMotivosFiltro() {
  const motivos = [...new Set(['Cadastro inicial', ...opcoes.motivosEntrada, ...opcoes.motivosSaida])];
  $('#mov-motivo').replaceChildren(
    criar('option', { value: '', textContent: 'Todos os motivos' }),
    ...motivos.map((m) => criar('option', { value: m, textContent: m }))
  );
}

const etiquetaOperacao = (operacao) =>
  criar('span', { className: `etiqueta ${operacao}`, textContent: operacao === 'entrada' ? '⬆ Entrada' : '⬇ Saída' });

async function carregarMovimentacoes() {
  const params = filtrosMovimentacoes();
  $('#btn-exportar-mov').href = `/api/movimentacoes/exportar.csv?${params}`;
  params.set('pagina', paginaMov);
  params.set('por_pagina', porPagina);
  const { dados: itens, total } = await api(`movimentacoes?${params}`, { completo: true });

  $('#corpo-mov').replaceChildren(
    ...itens.map((m) =>
      criar('tr', {}, [
        criar('td', { className: 'sem-quebra', textContent: formatarDataHora(m.criado_em) }),
        criar('td', {}, [m.item_nome, criar('small', { className: 'tipo-item', textContent: RECURSOS[m.recurso]?.categoria ?? '' })]),
        criar('td', {}, [etiquetaOperacao(m.operacao)]),
        criar('td', { textContent: m.motivo }),
        criar('td', { textContent: m.quantidade }),
        criar('td', { className: 'sem-quebra', textContent: `${m.quantidade_anterior} → ${m.quantidade_nova}` }),
        criar('td', { textContent: m.preco_unitario === null ? '—' : moeda.format(m.preco_unitario) }),
        criar('td', { textContent: m.preco_unitario === null ? '—' : moeda.format(m.preco_unitario * m.quantidade) }),
        criar('td', { textContent: m.usuario_nome ?? '—' }),
        criar('td', { className: 'observacao', textContent: m.observacao ?? '' }),
      ])
    )
  );
  $('#vazio-mov').hidden = itens.length > 0;
  desenharPaginacao($('#paginacao-mov'), paginaMov, total, (pagina) => {
    paginaMov = pagina;
    carregarMovimentacoes().catch((e) => avisar(e.message, true));
  });
}

async function abrirHistorico(item) {
  try {
    const historico = await api(`${abaAtual}/${item.id}/movimentacoes`);
    $('#titulo-historico').textContent = `Histórico — ${item.nome}`;
    $('#corpo-historico').replaceChildren(
      ...(historico.length
        ? historico.map((m) =>
            criar('tr', {}, [
              criar('td', { className: 'sem-quebra', textContent: formatarDataHora(m.criado_em) }),
              criar('td', {}, [etiquetaOperacao(m.operacao)]),
              criar('td', { textContent: m.motivo, title: m.observacao ?? '' }),
              criar('td', { textContent: m.quantidade }),
              criar('td', { className: 'sem-quebra', textContent: `${m.quantidade_anterior} → ${m.quantidade_nova}` }),
              criar('td', { textContent: m.preco_unitario === null ? '—' : moeda.format(m.preco_unitario) }),
              criar('td', { textContent: m.usuario_nome ?? '—' }),
            ])
          )
        : [criar('tr', {}, [criar('td', { colSpan: 7, className: 'vazio', textContent: 'Nenhuma movimentação registrada.' })])])
    );
    $('#dlg-historico').showModal();
  } catch (erro) {
    avisar(erro.message, true);
  }
}

async function trocarAba(aba) {
  if (RECURSOS[aba]?.soAdmin && !ehAdmin()) aba = 'resumo';
  abaAtual = aba;
  document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
  $('#secao-resumo').hidden = aba !== 'resumo';
  $('#secao-movimentacoes').hidden = aba !== 'movimentacoes';
  $('#secao-lista').hidden = aba === 'resumo' || aba === 'movimentacoes';
  try {
    if (aba === 'resumo') return await carregarResumo();
    if (aba === 'movimentacoes') {
      paginaMov = 1;
      return await carregarMovimentacoes();
    }
    const recurso = RECURSOS[aba];
    lista = { pagina: 1, ordenar: null, direcao: 'asc' };
    $('#titulo-lista').textContent = recurso.titulo;
    $('#busca').value = '';
    $('#filtro-colecao').value = '';
    $('#filtro-baixo').checked = false;
    $('#filtro-colecao').hidden = !recurso.porColecao;
    $('#rotulo-baixo').hidden = !recurso.estoque;
    $('#alternador-visao').hidden = !recurso.imagem;
    $('#btn-exportar').hidden = !recurso.exportar;
    if (recurso.porColecao || aba === 'colecoes') await carregarColecoes();
    await carregarLista();
  } catch (erro) {
    avisar(erro.message, true);
  }
}

const dlgMov = $('#dlg-movimentar');
const formMov = $('#form-movimentar');
let itemMovimentado = null;

function abrirMovimentacao(item, operacao) {
  itemMovimentado = item;
  formMov.reset();
  formMov.operacao.value = operacao;
  $('#mov-item-nome').textContent = item.nome;
  $('#mov-item-estoque').textContent = `— ${item.quantidade} em estoque`;
  $('#erro-movimentar').textContent = '';
  atualizarFormMovimentacao(true);
  dlgMov.showModal();
  formMov.quantidade.select();
}

function atualizarFormMovimentacao(trocouOperacao = false) {
  const operacao = formMov.operacao.value;
  if (trocouOperacao) {
    const motivos = operacao === 'entrada' ? opcoes.motivosEntrada : opcoes.motivosSaida;
    $('#mov-form-motivo').replaceChildren(...motivos.map((m) => criar('option', { value: m, textContent: m })));
    formMov.motivo.value = operacao === 'entrada' ? 'Compra' : 'Venda';
  }
  const motivo = formMov.motivo.value;
  const comValor = motivo === 'Venda' || motivo === 'Compra';
  $('#rotulo-valor-unitario').hidden = !comValor;
  if (comValor && (trocouOperacao || formMov.dataset.motivoAnterior !== motivo)) {
    $('#texto-valor-unitario').textContent = motivo === 'Venda' ? 'Preço de venda unitário (R$)' : 'Custo unitário pago (R$)';
    formMov.preco_unitario.value = motivo === 'Venda' ? itemMovimentado.preco : itemMovimentado.custo ?? 0;
  }
  formMov.dataset.motivoAnterior = motivo;

  const quantidade = Math.max(0, Math.trunc(Number(formMov.quantidade.value) || 0));
  const nova = itemMovimentado.quantidade + (operacao === 'entrada' ? quantidade : -quantidade);
  let texto = `Estoque: ${itemMovimentado.quantidade} → ${nova}`;
  if (comValor && quantidade) texto += ` · Total: ${moeda.format(quantidade * Number(formMov.preco_unitario.value || 0))}`;
  $('#previa-movimento').textContent = texto;
  $('#previa-movimento').classList.toggle('negativo', nova < 0);
}

formMov.addEventListener('change', (e) => atualizarFormMovimentacao(e.target.name === 'operacao'));
formMov.addEventListener('input', () => atualizarFormMovimentacao());

formMov.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(formMov));
  if ($('#rotulo-valor-unitario').hidden) delete dados.preco_unitario;
  try {
    await api(`${abaAtual}/${itemMovimentado.id}/estoque`, { method: 'PATCH', body: dados });
    dlgMov.close();
    avisar(`${dados.operacao === 'entrada' ? 'Entrada' : 'Saída'} registrada: ${dados.motivo}.`);
    await carregarLista();
  } catch (erro) {
    $('#erro-movimentar').textContent = erro.message;
  }
});

async function excluir(item) {
  const recurso = RECURSOS[abaAtual];
  const ok = await confirmar(
    `Excluir ${recurso.singular}?`,
    `"${item.nome}" será excluído. Essa ação não pode ser desfeita${recurso.estoque ? ' (o histórico de movimentações é mantido)' : ''}.`,
    'Excluir'
  );
  if (!ok) return;
  try {
    await api(`${abaAtual}/${item.id}`, { method: 'DELETE' });
    avisar('Registro excluído.');
    await carregarLista();
  } catch (erro) {
    avisar(erro.message, true);
  }
}

function abrirFormulario(item = null) {
  const recurso = RECURSOS[abaAtual];
  editandoId = item?.id ?? null;
  $('#titulo-form').textContent = `${item ? 'Editar' : 'Cadastrar'} ${recurso.singular}`;
  $('#erro-form').textContent = '';

  $('#campos-form').replaceChildren(
    ...recurso.campos.map((campo) => {
      let entrada;
      if (campo.opcoes) {
        entrada = criar('select', { name: campo.nome }, [
          criar('option', { value: '', textContent: 'Selecione...' }),
          ...campo.opcoes().map((op) => {
            const [valor, texto] = Array.isArray(op) ? op : [op, op];
            return criar('option', { value: valor, textContent: texto });
          }),
        ]);
      } else {
        entrada = criar('input', { name: campo.nome, type: campo.tipo ?? 'text' });
        if (campo.passo) Object.assign(entrada, { step: campo.passo, min: 0 });
        if (campo.tipo === 'password') entrada.autocomplete = 'new-password';
      }
      const obrigatorio = Boolean(campo.obrigatorio || (campo.obrigatorioCriar && !item));
      entrada.required = obrigatorio;
      entrada.value = campo.valor ? campo.valor(item) : item?.[campo.nome] ?? (campo.tipo === 'number' ? 0 : '');
      const rotulo = (item && campo.rotuloEdicao) || campo.rotulo;
      return criar('label', { className: campo.largo ? 'largo' : '' }, [`${rotulo}${obrigatorio ? ' *' : ''}`, entrada]);
    })
  );
  if (recurso.imagem) $('#campos-form').append(campoImagem(item));
  $('#modal').showModal();
}

async function reduzirImagem(arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAX_IMAGEM / Math.max(bitmap.width, bitmap.height));
  const canvas = criar('canvas', { width: Math.round(bitmap.width * escala), height: Math.round(bitmap.height * escala) });
  const contexto = canvas.getContext('2d');
  const gerar = (tipo) => new Promise((ok) => canvas.toBlob(ok, tipo, 0.85));

  contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let reduzida = await gerar('image/webp');
  if (!reduzida || reduzida.type !== 'image/webp') {
    contexto.globalCompositeOperation = 'destination-over';
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    reduzida = await gerar('image/jpeg');
  }
  bitmap.close();
  return escala === 1 && arquivo.size <= reduzida.size ? arquivo : reduzida;
}

function campoImagem(item) {
  imagemForm = { arquivo: null, remover: false };
  const previa = criar('img', { className: 'previa-imagem', alt: 'Pré-visualização' });
  const vazio = criar('span', { className: 'previa-vazia', textContent: 'Sem imagem' });
  const entrada = criar('input', { type: 'file', accept: TIPOS_IMAGEM.join(',') });
  const remover = criar('button', { type: 'button', className: 'mini perigo', textContent: 'Remover imagem' });
  const info = criar('small', { className: 'info-imagem' });

  const mostrar = (url) => {
    previa.hidden = !url;
    vazio.hidden = Boolean(url);
    remover.hidden = !url;
    if (url) previa.src = url;
  };

  entrada.addEventListener('change', async () => {
    const arquivo = entrada.files[0];
    $('#erro-form').textContent = '';
    info.textContent = '';
    if (!arquivo) return;
    const falhar = (mensagem) => {
      entrada.value = '';
      $('#erro-form').textContent = mensagem;
    };
    if (!TIPOS_IMAGEM.includes(arquivo.type)) return falhar('Formato de imagem inválido. Use PNG, JPG, WEBP ou GIF.');
    if (arquivo.size > TAMANHO_MAX_ORIGINAL) return falhar('Imagem muito grande. O tamanho máximo é 20 MB.');
    try {
      info.textContent = 'Otimizando imagem...';
      const reduzida = await reduzirImagem(arquivo);
      if (reduzida.size > TAMANHO_MAX_ENVIO) return falhar('Mesmo reduzida, a imagem passou de 5 MB. Tente outra foto.');
      imagemForm = { arquivo: reduzida, remover: false };
      mostrar(URL.createObjectURL(reduzida));
      const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
      info.textContent = reduzida === arquivo ? kb(arquivo.size) : `${kb(arquivo.size)} → ${kb(reduzida.size)}`;
    } catch {
      info.textContent = '';
      falhar('Não foi possível ler essa imagem.');
    }
  });

  remover.addEventListener('click', () => {
    imagemForm = { arquivo: null, remover: Boolean(item?.imagem) };
    entrada.value = '';
    info.textContent = '';
    mostrar(null);
  });

  mostrar(urlImagem(item));
  return criar('div', { className: 'campo-imagem largo' }, [
    criar('div', { className: 'moldura-previa' }, [previa, vazio]),
    criar('div', { className: 'controles-imagem' }, [
      criar('label', {}, ['Imagem (PNG, JPG, WEBP ou GIF), reduzida automaticamente', entrada]),
      info,
      remover,
    ]),
  ]);
}

async function salvarImagem(id) {
  if (imagemForm.arquivo) {
    await api(`${abaAtual}/${id}/imagem`, { method: 'PUT', body: imagemForm.arquivo });
  } else if (imagemForm.remover) {
    await api(`${abaAtual}/${id}/imagem`, { method: 'DELETE' });
  }
}

$('#form').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(evento.target));
  const recurso = RECURSOS[abaAtual];
  try {
    if (editandoId) {
      await api(`${abaAtual}/${editandoId}`, { method: 'PUT', body: dados });
    } else {
      editandoId = (await api(abaAtual, { method: 'POST', body: dados })).id;
    }
    if (recurso.imagem) await salvarImagem(editandoId);
    avisar('Registro salvo.');
    $('#modal').close();
    if (recurso.porColecao || abaAtual === 'colecoes') await carregarColecoes();
    await carregarLista();
  } catch (erro) {
    $('#erro-form').textContent = erro.message;
    carregarLista().catch(() => {});
  }
});

const dlgSenha = $('#dlg-senha');
let senhaObrigatoria = false;

function abrirTrocaSenha(obrigatoria = false) {
  if (dlgSenha.open) return;
  senhaObrigatoria = obrigatoria;
  $('#form-senha').reset();
  $('#erro-senha').textContent = '';
  $('#aviso-senha').hidden = !obrigatoria;
  $('#btn-cancelar-senha').hidden = obrigatoria;
  dlgSenha.showModal();
}

dlgSenha.addEventListener('cancel', (e) => senhaObrigatoria && e.preventDefault());

$('#form-senha').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(evento.target));
  if (dados.nova_senha !== dados.confirmacao) {
    $('#erro-senha').textContent = 'As senhas digitadas não são iguais.';
    return;
  }
  try {
    usuario = await api('auth/senha', { method: 'POST', body: { senha_atual: dados.senha_atual, nova_senha: dados.nova_senha } });
    const eraObrigatoria = senhaObrigatoria;
    senhaObrigatoria = false;
    dlgSenha.close();
    avisar('Senha alterada.');
    if (eraObrigatoria) iniciarSistema();
  } catch (erro) {
    $('#erro-senha').textContent = erro.message;
  }
});

$('#btn-senha').addEventListener('click', () => abrirTrocaSenha(false));

$('#btn-sair').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.replace('login.html');
});

$('#btn-backup').addEventListener('click', async () => {
  const botao = $('#btn-backup');
  botao.disabled = true;
  try {
    const resposta = await fetch('/api/backup');
    if (!resposta.ok) throw new Error((await resposta.json()).erro || 'Não foi possível gerar o backup.');
    const nome = /filename="([^"]+)"/.exec(resposta.headers.get('Content-Disposition') ?? '')?.[1] ?? 'hypecards-backup.zip';
    const link = criar('a', { href: URL.createObjectURL(await resposta.blob()), download: nome });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    avisar('Backup baixado.');
  } catch (erro) {
    avisar(erro.message, true);
  } finally {
    botao.disabled = false;
  }
});

$('#btn-cancelar').addEventListener('click', () => $('#modal').close());
document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$('#visualizador').addEventListener('click', () => $('#visualizador').close());
$('#btn-novo').addEventListener('click', () => abrirFormulario());
$('#abas').addEventListener('click', (e) => e.target.dataset.aba && trocarAba(e.target.dataset.aba));

$('#alternador-visao').addEventListener('click', (e) => {
  if (!e.target.dataset.visao) return;
  salvarPreferencia(`visao-${abaAtual}`, e.target.dataset.visao);
  carregarLista().catch((erro) => avisar(erro.message, true));
});

function aoMudar(seletores, acao, eventos = ['change']) {
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
aoMudar(['#busca'], () => { lista.pagina = 1; return carregarLista(); }, ['input']);
aoMudar(['#filtro-colecao', '#filtro-baixo'], () => { lista.pagina = 1; return carregarLista(); });
aoMudar(['#mov-busca'], () => { paginaMov = 1; return carregarMovimentacoes(); }, ['input']);
aoMudar(['#mov-recurso', '#mov-operacao', '#mov-motivo', '#mov-de', '#mov-ate'], () => { paginaMov = 1; return carregarMovimentacoes(); });

async function iniciarSistema() {
  const perfil = usuario.perfil === 'admin' ? 'Administrador' : 'Vendedor';
  $('#nome-usuario').textContent = usuario.nome === perfil ? usuario.nome : `${usuario.nome} · ${perfil}`;
  document.querySelectorAll('[data-admin]').forEach((el) => (el.hidden = !ehAdmin()));
  opcoes = await api('opcoes');
  preencherMotivosFiltro();
  trocarAba('resumo');
}

usuario = await api('auth/eu');
if (usuario.trocar_senha) {
  $('#nome-usuario').textContent = usuario.nome;
  abrirTrocaSenha(true);
} else {
  await iniciarSistema();
}
