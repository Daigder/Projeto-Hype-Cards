import { $, criar, moeda, porcentagem, plural } from './util.js';
import { api } from './api.js';
import { nomeCategoria } from './recursos.js';
import { miniatura, linhaVazia } from './componentes.js';

const card = (rotulo, valorTexto, detalhe, classe = '') =>
  criar('div', { className: `card ${classe}` }, [
    criar('div', { className: 'rotulo', textContent: rotulo }),
    criar('div', { className: 'valor', textContent: valorTexto }),
    criar('div', { className: 'detalhe', textContent: detalhe }),
  ]);

export async function abrirResumo() {
  const r = await api('resumo');
  const categorias = [r.cartas, r.produtos, r.acessorios];
  const soma = (campo) => categorias.reduce((total, c) => total + c[campo], 0);
  const valor = soma('valor');
  const custo = soma('custo');
  const { vendasMes } = r;
  const margem = vendasMes.faturamento > 0 ? vendasMes.lucro / vendasMes.faturamento : 0;
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

  const vendidos = r.maisVendidos.map((i) =>
    criar('tr', {}, [
      criar('td', { textContent: i.nome }),
      criar('td', { textContent: nomeCategoria(i.recurso) }),
      criar('td', { textContent: i.unidades }),
      criar('td', { textContent: moeda.format(i.faturamento) }),
    ])
  );
  $('#tabela-vendidos').replaceChildren(...(vendidos.length ? vendidos : [linhaVazia(4, 'Nenhuma venda registrada neste mês.')]));

  const baixos = r.estoqueBaixo.map((i) =>
    criar('tr', {}, [
      criar('td', { className: 'celula-foto' }, [miniatura(i)]),
      criar('td', { textContent: i.nome }),
      criar('td', { textContent: nomeCategoria(i.recurso) }),
      criar('td', {}, [criar('span', { className: 'badge baixo', textContent: i.quantidade })]),
      criar('td', { textContent: i.estoque_minimo }),
    ])
  );
  $('#tabela-baixo').replaceChildren(...(baixos.length ? baixos : [linhaVazia(5, 'Tudo certo! Nenhum item abaixo do mínimo.')]));
}
