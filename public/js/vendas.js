import { $, criar, moeda, avisar, aoMudar, formatarDataHora, numeroVenda, plural } from './util.js';
import { api } from './api.js';
import { estado, ehAdmin } from './estado.js';
import { nomeCategoria } from './recursos.js';
import { miniatura, etiquetaSituacao, desenharPaginacao, linhaVazia } from './componentes.js';

const centavos = (valor) => Math.round(valor * 100) / 100;
let carrinho = [];
let pagina = 1;
let vendaAberta = null;
let aoMudarVendas = () => {};

export function aoAtualizarVendas(callback) {
  aoMudarVendas = callback;
}

function calcular() {
  const subtotal = centavos(carrinho.reduce((soma, i) => soma + centavos(i.preco * i.quantidade), 0));
  const tipo = $('#venda-desconto-tipo').value;
  const informado = Math.max(0, Number($('#venda-desconto-valor').value) || 0);
  const desconto = tipo === 'percentual' ? centavos((subtotal * Math.min(informado, 100)) / 100) : centavos(Math.min(informado, subtotal));
  return { subtotal, desconto, total: centavos(subtotal - desconto) };
}

function desenharCarrinho() {
  const unidades = carrinho.reduce((soma, i) => soma + i.quantidade, 0);
  $('#venda-qtd').textContent = carrinho.length ? plural(unidades, 'unidade', 'unidades') : '';
  $('#venda-vazio').hidden = carrinho.length > 0;
  $('#venda-itens').replaceChildren(
    ...carrinho.map((linha, indice) => {
      const quantidade = criar('input', { type: 'number', min: 1, max: linha.estoque, step: 1, value: linha.quantidade, className: 'qtd-carrinho', title: `Disponível: ${linha.estoque}` });
      quantidade.addEventListener('input', () => {
        const valor = Math.trunc(Number(quantidade.value));
        if (valor >= 1) linha.quantidade = Math.min(valor, linha.estoque);
        atualizarTotais();
      });
      quantidade.addEventListener('change', desenharCarrinho);
      const preco = criar('input', { type: 'number', min: 0, step: '0.01', value: linha.preco, className: 'preco-carrinho', title: 'Preço unitário (R$)' });
      preco.addEventListener('input', () => {
        linha.preco = Math.max(0, Number(preco.value) || 0);
        atualizarTotais();
      });
      const mudar = (delta) => {
        linha.quantidade = Math.min(linha.estoque, Math.max(1, linha.quantidade + delta));
        desenharCarrinho();
      };
      return criar('div', { className: 'linha-carrinho' }, [
        miniatura(linha),
        criar('div', { className: 'linha-carrinho-nome' }, [
          criar('strong', { textContent: linha.nome }),
          criar('small', { textContent: `${nomeCategoria(linha.recurso)} · ${linha.estoque} em estoque` }),
        ]),
        criar('label', { className: 'campo-mini' }, ['R$', preco]),
        criar('span', { className: 'estoque' }, [
          criar('button', { type: 'button', className: 'mini', textContent: '−', title: 'Diminuir', disabled: linha.quantidade <= 1, onclick: () => mudar(-1) }),
          quantidade,
          criar('button', { type: 'button', className: 'mini', textContent: '+', title: 'Aumentar', disabled: linha.quantidade >= linha.estoque, onclick: () => mudar(1) }),
        ]),
        criar('strong', { className: 'linha-carrinho-total', textContent: moeda.format(centavos(linha.preco * linha.quantidade)) }),
        criar('button', { type: 'button', className: 'mini perigo', textContent: '✕', title: 'Remover do carrinho', onclick: () => { carrinho.splice(indice, 1); desenharCarrinho(); } }),
      ]);
    })
  );
  atualizarTotais();
}

function atualizarTotais() {
  const { subtotal, desconto, total } = calcular();
  $('#venda-subtotal').textContent = moeda.format(subtotal);
  $('#venda-desconto').textContent = desconto ? `− ${moeda.format(desconto)}` : moeda.format(0);
  $('#venda-total').textContent = moeda.format(total);
  document.querySelectorAll('.linha-carrinho-total').forEach((el, i) => {
    if (carrinho[i]) el.textContent = moeda.format(centavos(carrinho[i].preco * carrinho[i].quantidade));
  });
  $('#btn-finalizar').disabled = carrinho.length === 0;
}

function adicionar(item) {
  const existente = carrinho.find((l) => l.recurso === item.recurso && l.id === item.id);
  if (existente) {
    if (existente.quantidade >= item.quantidade) return avisar(`Só há ${item.quantidade} unidade(s) de ${item.nome}.`, true);
    existente.quantidade += 1;
  } else {
    carrinho.push({ recurso: item.recurso, id: item.id, nome: item.nome, imagem: item.imagem, preco: item.preco, estoque: item.quantidade, quantidade: 1 });
  }
  desenharCarrinho();
}

async function buscarCatalogo() {
  const busca = $('#venda-busca').value.trim();
  const itens = await api(`vendas/catalogo?busca=${encodeURIComponent(busca)}`);
  $('#venda-resultados').replaceChildren(
    ...(itens.length
      ? itens.map((item) =>
          criar('li', { className: 'resultado' }, [
            miniatura(item),
            criar('div', { className: 'resultado-nome' }, [
              criar('strong', { textContent: item.nome }),
              criar('small', { textContent: `${nomeCategoria(item.recurso)} · ${item.quantidade > 0 ? plural(item.quantidade, 'unidade', 'unidades') + ' em estoque' : 'sem estoque'}` }),
            ]),
            criar('strong', { className: 'resultado-preco', textContent: moeda.format(item.preco) }),
            criar('button', { type: 'button', className: 'mini primario', textContent: '+ Adicionar', disabled: item.quantidade <= 0, onclick: () => adicionar(item) }),
          ])
        )
      : [criar('li', { className: 'vazio', textContent: 'Nenhum item encontrado.' })])
  );
}

function limparVenda() {
  carrinho = [];
  $('#form-venda').reset();
  $('#venda-desconto-valor').value = 0;
  $('#erro-venda').textContent = '';
  desenharCarrinho();
}

async function finalizarVenda(evento) {
  evento.preventDefault();
  $('#erro-venda').textContent = '';
  const forma = $('#form-venda').forma_pagamento.value;
  if (!forma) {
    $('#erro-venda').textContent = 'Escolha a forma de pagamento.';
    return;
  }
  const botao = $('#btn-finalizar');
  botao.disabled = true;
  try {
    const venda = await api('vendas', {
      method: 'POST',
      body: {
        itens: carrinho.map((l) => ({ recurso: l.recurso, item_id: l.id, quantidade: l.quantidade, preco_unitario: l.preco })),
        desconto: { tipo: $('#venda-desconto-tipo').value, valor: Number($('#venda-desconto-valor').value) || 0 },
        forma_pagamento: forma,
        cliente: $('#venda-cliente').value,
        observacao: $('#venda-observacao').value,
      },
    });
    limparVenda();
    await buscarCatalogo();
    avisar(`Venda ${numeroVenda(venda.id)} registrada.`);
    mostrarRecibo(venda);
  } catch (erro) {
    $('#erro-venda').textContent = erro.message;
  } finally {
    botao.disabled = carrinho.length === 0;
  }
}

export async function abrirVender() {
  desenharCarrinho();
  await buscarCatalogo();
  $('#venda-busca').focus();
}

function filtrosVendas() {
  const params = new URLSearchParams();
  const campos = { busca: '#vendas-busca', forma_pagamento: '#vendas-pagamento', situacao: '#vendas-situacao', de: '#vendas-de', ate: '#vendas-ate' };
  for (const [nome, seletor] of Object.entries(campos)) {
    if ($(seletor).value) params.set(nome, $(seletor).value);
  }
  return params;
}

async function carregarVendas() {
  const params = filtrosVendas();
  params.set('pagina', pagina);
  params.set('por_pagina', estado.porPagina);
  const { dados: vendas, total } = await api(`vendas?${params}`, { completo: true });
  $('#corpo-vendas').replaceChildren(
    ...vendas.map((v) =>
      criar('tr', { className: v.situacao === 'estornada' ? 'estornada' : '' }, [
        criar('td', { className: 'cod sem-quebra', textContent: numeroVenda(v.id) }),
        criar('td', { className: 'sem-quebra', textContent: formatarDataHora(v.criado_em) }),
        criar('td', { textContent: v.cliente ?? '—' }),
        criar('td', { textContent: `${plural(v.qtd_itens, 'item', 'itens')} · ${v.unidades} un.` }),
        criar('td', { textContent: v.forma_pagamento }),
        criar('td', { textContent: v.desconto ? moeda.format(v.desconto) : '—' }),
        criar('td', { className: 'sem-quebra' }, [criar('strong', { textContent: moeda.format(v.total) })]),
        criar('td', { textContent: v.usuario_nome ?? '—' }),
        criar('td', {}, [etiquetaSituacao(v.situacao)]),
        criar('td', { className: 'acoes-linha' }, [
          criar('div', { className: 'botoes-linha' }, [criar('button', { className: 'mini', textContent: 'Recibo', onclick: () => abrirVenda(v.id) })]),
        ]),
      ])
    )
  );
  if (!vendas.length) $('#corpo-vendas').replaceChildren(linhaVazia(10, 'Nenhuma venda encontrada.'));
  desenharPaginacao($('#paginacao-vendas'), pagina, total, (nova) => {
    pagina = nova;
    carregarVendas().catch((e) => avisar(e.message, true));
  });
}

export async function abrirVendas() {
  pagina = 1;
  await carregarVendas();
}

function linhaRecibo(rotulo, valor, classe = '') {
  return criar('div', { className: `recibo-linha ${classe}` }, [criar('span', { textContent: rotulo }), criar('strong', { textContent: valor })]);
}

function mostrarRecibo(venda) {
  vendaAberta = venda;
  const estornada = venda.situacao === 'estornada';
  const itens = venda.itens.map((i) =>
    criar('tr', {}, [
      criar('td', { textContent: i.quantidade }),
      criar('td', {}, [i.item_nome, criar('small', { className: 'tipo-item', textContent: nomeCategoria(i.recurso) })]),
      criar('td', { className: 'num', textContent: moeda.format(i.preco_unitario) }),
      criar('td', { className: 'num', textContent: moeda.format(i.preco_unitario * i.quantidade) }),
    ])
  );
  $('#recibo').replaceChildren(
    criar('div', { className: 'recibo-topo' }, [
      criar('img', { src: 'logo.png', alt: 'Logo Hype Cards' }),
      criar('div', {}, [criar('strong', { textContent: 'HYPE CARDS' }), criar('span', { textContent: 'Cartas, produtos e acessórios Pokémon TCG' })]),
    ]),
    criar('h3', { textContent: `Recibo de venda ${numeroVenda(venda.id)}` }),
    ...(estornada
      ? [criar('p', { className: 'recibo-estornada', textContent: `VENDA ESTORNADA em ${formatarDataHora(venda.estornada_em)}${venda.estornada_por ? ` por ${venda.estornada_por}` : ''}${venda.motivo_estorno ? ` · ${venda.motivo_estorno}` : ''}` })]
      : []),
    criar('div', { className: 'recibo-dados' }, [
      linhaRecibo('Data', formatarDataHora(venda.criado_em)),
      linhaRecibo('Vendedor', venda.usuario_nome ?? '—'),
      linhaRecibo('Cliente', venda.cliente ?? '—'),
      linhaRecibo('Pagamento', venda.forma_pagamento),
    ]),
    criar('table', { className: 'recibo-itens' }, [
      criar('thead', {}, [criar('tr', {}, ['Qtd.', 'Item', 'Unitário', 'Total'].map((t, i) => criar('th', { textContent: t, className: i > 1 ? 'num' : '' })))]),
      criar('tbody', {}, itens),
    ]),
    criar('div', { className: 'recibo-totais' }, [
      linhaRecibo('Subtotal', moeda.format(venda.subtotal)),
      ...(venda.desconto ? [linhaRecibo('Desconto', `− ${moeda.format(venda.desconto)}`)] : []),
      linhaRecibo('Total', moeda.format(venda.total), 'recibo-total'),
    ]),
    ...(venda.observacao ? [criar('p', { className: 'recibo-obs', textContent: `Observação: ${venda.observacao}` })] : []),
    criar('p', { className: 'recibo-rodape', textContent: 'Obrigado pela preferência!' })
  );
  $('#erro-recibo').textContent = '';
  $('#btn-estornar').hidden = !ehAdmin() || estornada;
  if (!$('#dlg-recibo').open) $('#dlg-recibo').showModal();
}

export async function abrirVenda(id) {
  try {
    mostrarRecibo(await api(`vendas/${id}`));
  } catch (erro) {
    avisar(erro.message, true);
  }
}

function textoRecibo(venda) {
  const linhas = [
    'HYPE CARDS',
    `Recibo de venda ${numeroVenda(venda.id)}`,
    venda.situacao === 'estornada' ? `*** VENDA ESTORNADA em ${formatarDataHora(venda.estornada_em)} ***` : null,
    `Data: ${formatarDataHora(venda.criado_em)}`,
    `Vendedor: ${venda.usuario_nome ?? '—'}`,
    venda.cliente ? `Cliente: ${venda.cliente}` : null,
    '',
    ...venda.itens.map((i) => `${i.quantidade} x ${i.item_nome} — ${moeda.format(i.preco_unitario)} = ${moeda.format(i.preco_unitario * i.quantidade)}`),
    '',
    `Subtotal: ${moeda.format(venda.subtotal)}`,
    venda.desconto ? `Desconto: − ${moeda.format(venda.desconto)}` : null,
    `Total: ${moeda.format(venda.total)}`,
    `Pagamento: ${venda.forma_pagamento}`,
    '',
    'Obrigado pela preferência!',
  ];
  return linhas.filter((l) => l !== null).join('\n');
}

export function iniciarVendas() {
  $('#venda-pagamentos').replaceChildren(
    ...estado.opcoes.formasPagamento.map((forma) =>
      criar('label', {}, [criar('input', { type: 'radio', name: 'forma_pagamento', value: forma }), ` ${forma}`])
    )
  );
  $('#vendas-pagamento').replaceChildren(
    criar('option', { value: '', textContent: 'Todas as formas' }),
    ...[...estado.opcoes.formasPagamento, 'Não informada'].map((f) => criar('option', { value: f, textContent: f }))
  );

  $('#form-venda').addEventListener('submit', finalizarVenda);
  $('#btn-limpar-venda').addEventListener('click', limparVenda);
  $('#venda-desconto-tipo').addEventListener('change', atualizarTotais);
  $('#venda-desconto-valor').addEventListener('input', atualizarTotais);
  aoMudar(['#venda-busca'], buscarCatalogo, ['input']);
  aoMudar(['#vendas-busca'], () => { pagina = 1; return carregarVendas(); }, ['input']);
  aoMudar(['#vendas-pagamento', '#vendas-situacao', '#vendas-de', '#vendas-ate'], () => { pagina = 1; return carregarVendas(); });

  $('#btn-copiar-recibo').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(textoRecibo(vendaAberta));
      avisar('Recibo copiado. Cole no WhatsApp ou no e-mail do cliente.');
    } catch {
      avisar('Não foi possível copiar automaticamente.', true);
    }
  });
  $('#btn-imprimir-recibo').addEventListener('click', () => {
    document.body.classList.add('imprimindo-recibo');
    window.print();
  });
  window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo-recibo'));

  $('#btn-estornar').addEventListener('click', () => {
    $('#form-estorno').reset();
    $('#estorno-numero').textContent = numeroVenda(vendaAberta.id);
    $('#erro-estorno').textContent = '';
    $('#dlg-estorno').showModal();
  });
  $('#form-estorno').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const motivo = $('#form-estorno').motivo.value.trim();
    if (!motivo) {
      $('#erro-estorno').textContent = 'Informe o motivo do estorno.';
      return;
    }
    try {
      const venda = await api(`vendas/${vendaAberta.id}/estorno`, { method: 'POST', body: { motivo } });
      $('#dlg-estorno').close();
      mostrarRecibo(venda);
      avisar(`Venda ${numeroVenda(venda.id)} estornada. Os itens voltaram para o estoque.`);
      aoMudarVendas();
    } catch (erro) {
      $('#erro-estorno').textContent = erro.message;
    }
  });
}
