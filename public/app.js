const $ = (seletor) => document.querySelector(seletor);
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarData = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

async function api(caminho, { method = 'GET', body } = {}) {
  const resposta = await fetch(`/api/${caminho}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (resposta.status === 204) return null;
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro || 'Erro inesperado.');
  return dados;
}

let opcoes = {};
let colecoes = [];
let abaAtual = 'resumo';
let editandoId = null;

const colunaColecao = ['Coleção', (i) => i.colecao_nome];
const colunaPreco = ['Preço', (i) => moeda.format(i.preco)];
const camposEstoque = [
  { nome: 'preco', rotulo: 'Preço (R$)', tipo: 'number', passo: '0.01' },
  { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'number', passo: '1' },
  { nome: 'estoque_minimo', rotulo: 'Estoque mínimo', tipo: 'number', passo: '1' },
];
const campoColecao = { nome: 'colecao_id', rotulo: 'Coleção', opcoes: () => colecoes.map((c) => [c.id, c.nome]), obrigatorio: true };

const RECURSOS = {
  colecoes: {
    titulo: 'Coleções',
    singular: 'coleção',
    colunas: [
      ['Nome', (i) => i.nome],
      ['Sigla', (i) => i.sigla],
      ['Série', (i) => i.serie],
      ['Lançamento', (i) => formatarData(i.data_lancamento)],
      ['Cartas', (i) => i.total_cartas],
      ['Produtos', (i) => i.total_produtos],
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
    estoque: true,
    porColecao: true,
    colunas: [
      ['Nome', (i) => i.nome],
      colunaColecao,
      ['Nº', (i) => i.numero],
      ['Raridade', (i) => i.raridade],
      ['Condição', (i) => i.condicao],
      ['Idioma', (i) => i.idioma],
      colunaPreco,
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
    estoque: true,
    porColecao: true,
    colunas: [['Nome', (i) => i.nome], colunaColecao, ['Tipo', (i) => i.tipo], colunaPreco],
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
    estoque: true,
    colunas: [['Nome', (i) => i.nome], ['Categoria', (i) => i.categoria], ['Marca', (i) => i.marca], colunaPreco],
    campos: [
      { nome: 'nome', rotulo: 'Nome', obrigatorio: true, largo: true },
      { nome: 'categoria', rotulo: 'Categoria', opcoes: () => opcoes.categoriasAcessorio, obrigatorio: true },
      { nome: 'marca', rotulo: 'Marca' },
      ...camposEstoque,
    ],
  },
};

function avisar(mensagem, falha = false) {
  const aviso = $('#aviso');
  aviso.textContent = mensagem;
  aviso.classList.toggle('falha', falha);
  aviso.hidden = false;
  clearTimeout(avisar.timer);
  avisar.timer = setTimeout(() => (aviso.hidden = true), 3000);
}

function criar(tag, propriedades = {}, filhos = []) {
  const el = Object.assign(document.createElement(tag), propriedades);
  el.append(...filhos);
  return el;
}

// ---------- Resumo ----------

async function carregarResumo() {
  const r = await api('resumo');
  const unidades = r.cartas.unidades + r.produtos.unidades + r.acessorios.unidades;
  const valor = r.cartas.valor + r.produtos.valor + r.acessorios.valor;
  const card = (rotulo, valorTexto, detalhe, destaque = false) =>
    criar('div', { className: `card${destaque ? ' destaque' : ''}` }, [
      criar('div', { className: 'rotulo', textContent: rotulo }),
      criar('div', { className: 'valor', textContent: valorTexto }),
      criar('div', { className: 'detalhe', textContent: detalhe }),
    ]);
  const detalhe = (t) => `${t.itens} itens · ${t.estoque_baixo} com estoque baixo`;

  $('#cards-resumo').replaceChildren(
    card('Valor total em estoque', moeda.format(valor), `${unidades} unidades`, true),
    card('Coleções', r.colecoes, 'cadastradas'),
    card('Cartas', r.cartas.unidades, detalhe(r.cartas)),
    card('Produtos selados', r.produtos.unidades, detalhe(r.produtos)),
    card('Acessórios', r.acessorios.unidades, detalhe(r.acessorios)),
  );

  const linhas = r.estoqueBaixo.map((i) =>
    criar('tr', {}, [
      criar('td', { textContent: i.nome }),
      criar('td', { textContent: RECURSOS[i.recurso].titulo }),
      criar('td', {}, [criar('span', { className: 'badge baixo', textContent: i.quantidade })]),
      criar('td', { textContent: i.estoque_minimo }),
    ])
  );
  if (!linhas.length) {
    linhas.push(criar('tr', {}, [criar('td', { colSpan: 4, className: 'vazio', textContent: 'Tudo certo! Nenhum item abaixo do mínimo.' })]));
  }
  $('#tabela-baixo').replaceChildren(...linhas);
}

// ---------- Listagem ----------

async function carregarLista() {
  const recurso = RECURSOS[abaAtual];
  const params = new URLSearchParams();
  if ($('#busca').value) params.set('busca', $('#busca').value);
  if (recurso.porColecao && $('#filtro-colecao').value) params.set('colecao_id', $('#filtro-colecao').value);
  if (recurso.estoque && $('#filtro-baixo').checked) params.set('estoque_baixo', '1');

  const itens = await api(`${abaAtual}?${params}`);
  const titulos = recurso.colunas.map(([titulo]) => titulo);
  if (recurso.estoque) titulos.push('Estoque');
  titulos.push('');
  $('#cabecalho').replaceChildren(criar('tr', {}, titulos.map((t) => criar('th', { textContent: t }))));

  $('#corpo').replaceChildren(
    ...itens.map((item) => {
      const celulas = recurso.colunas.map(([, valor]) => criar('td', { textContent: valor(item) ?? '' }));
      if (recurso.estoque) {
        const baixo = item.quantidade <= item.estoque_minimo;
        celulas.push(
          criar('td', {}, [
            criar('span', { className: 'estoque' }, [
              criar('button', { className: 'mini', textContent: '−', title: 'Saída de estoque', onclick: () => movimentar(item, 'saida') }),
              criar('span', { className: `badge${baixo ? ' baixo' : ''}`, textContent: item.quantidade, title: `Mínimo: ${item.estoque_minimo}` }),
              criar('button', { className: 'mini', textContent: '+', title: 'Entrada de estoque', onclick: () => movimentar(item, 'entrada') }),
            ]),
          ])
        );
      }
      celulas.push(
        criar('td', { className: 'acoes-linha' }, [
          criar('button', { className: 'mini', textContent: 'Editar', onclick: () => abrirFormulario(item) }),
          criar('button', { className: 'mini perigo', textContent: 'Excluir', onclick: () => excluir(item) }),
        ])
      );
      return criar('tr', {}, celulas);
    })
  );
  $('#vazio').hidden = itens.length > 0;
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

async function trocarAba(aba) {
  abaAtual = aba;
  document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
  $('#secao-resumo').hidden = aba !== 'resumo';
  $('#secao-lista').hidden = aba === 'resumo';
  try {
    if (aba === 'resumo') return await carregarResumo();
    const recurso = RECURSOS[aba];
    $('#titulo-lista').textContent = recurso.titulo;
    $('#busca').value = '';
    $('#filtro-colecao').value = '';
    $('#filtro-baixo').checked = false;
    $('#filtro-colecao').hidden = !recurso.porColecao;
    $('#rotulo-baixo').hidden = !recurso.estoque;
    await carregarColecoes();
    await carregarLista();
  } catch (erro) {
    avisar(erro.message, true);
  }
}

// ---------- Ações ----------

async function movimentar(item, operacao) {
  const texto = prompt(`Quantas unidades de "${item.nome}" deseja dar ${operacao === 'entrada' ? 'entrada' : 'saída'}?`, '1');
  if (texto === null) return;
  try {
    await api(`${abaAtual}/${item.id}/estoque`, { method: 'PATCH', body: { operacao, quantidade: Number(texto) } });
    avisar('Estoque atualizado.');
    await carregarLista();
  } catch (erro) {
    avisar(erro.message, true);
  }
}

async function excluir(item) {
  if (!confirm(`Excluir "${item.nome}"? Essa ação não pode ser desfeita.`)) return;
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
      }
      entrada.required = Boolean(campo.obrigatorio);
      entrada.value = item?.[campo.nome] ?? (campo.tipo === 'number' ? 0 : '');
      return criar('label', { className: campo.largo ? 'largo' : '' }, [`${campo.rotulo}${campo.obrigatorio ? ' *' : ''}`, entrada]);
    })
  );
  $('#modal').showModal();
}

$('#form').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(evento.target));
  try {
    if (editandoId) {
      await api(`${abaAtual}/${editandoId}`, { method: 'PUT', body: dados });
      avisar('Registro atualizado.');
    } else {
      await api(abaAtual, { method: 'POST', body: dados });
      avisar('Registro criado.');
    }
    $('#modal').close();
    await carregarColecoes();
    await carregarLista();
  } catch (erro) {
    $('#erro-form').textContent = erro.message;
  }
});

$('#btn-cancelar').addEventListener('click', () => $('#modal').close());
$('#btn-novo').addEventListener('click', () => abrirFormulario());
$('#abas').addEventListener('click', (e) => e.target.dataset.aba && trocarAba(e.target.dataset.aba));

let atrasoBusca;
$('#busca').addEventListener('input', () => {
  clearTimeout(atrasoBusca);
  atrasoBusca = setTimeout(carregarLista, 250);
});
$('#filtro-colecao').addEventListener('change', carregarLista);
$('#filtro-baixo').addEventListener('change', carregarLista);

opcoes = await api('opcoes');
trocarAba('resumo');
