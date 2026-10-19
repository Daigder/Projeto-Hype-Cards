import { criar, criarSvg } from './util.js';

function passoRedondo(maximo, divisoes) {
  const bruto = maximo / divisoes;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const fator = [1, 2, 2.5, 5, 10].find((f) => f * potencia >= bruto);
  return fator * potencia;
}

function escala(valores, divisoes = 4) {
  const maior = Math.max(0, ...valores);
  const menor = Math.min(0, ...valores);
  const passo = passoRedondo(Math.max(maior - menor, 1), divisoes);
  const topo = Math.ceil(maior / passo) * passo || passo;
  const base = Math.floor(menor / passo) * passo;
  const marcas = [];
  for (let v = base; v <= topo + passo / 2; v += passo) marcas.push(Math.round(v * 100) / 100);
  return { base, topo, marcas };
}

export function barrasVerticais(container, { rotulos, series, formatarEixo, formatar, vazio }) {
  const todos = series.flatMap((s) => s.valores);
  if (!todos.some((v) => v !== 0)) {
    container.replaceChildren(criar('p', { className: 'vazio', textContent: vazio }));
    return;
  }
  const L = Math.max(360, Math.round(container.clientWidth) || 760), A = 300, esq = 72, dir = 12, cima = 36, baixo = 34;
  const larguraUtil = L - esq - dir, alturaUtil = A - cima - baixo;
  const { base, topo, marcas } = escala(todos);
  const y = (v) => cima + alturaUtil - ((v - base) / (topo - base)) * alturaUtil;
  const grupo = larguraUtil / rotulos.length;
  const larguraBarra = Math.min(28, (grupo * 0.72) / series.length);
  const saltoRotulo = Math.ceil(rotulos.length / Math.max(2, Math.floor(larguraUtil / 64)));

  const elementos = [];
  for (const marca of marcas) {
    elementos.push(
      criarSvg('line', { x1: esq, x2: L - dir, y1: y(marca), y2: y(marca), class: marca === 0 ? 'eixo-zero' : 'grade' }),
      criarSvg('text', { x: esq - 8, y: y(marca) + 4, 'text-anchor': 'end', class: 'eixo-texto' }, [formatarEixo(marca)])
    );
  }
  rotulos.forEach((rotulo, i) => {
    const centro = esq + grupo * i + grupo / 2;
    const inicio = centro - (larguraBarra * series.length) / 2;
    series.forEach((serie, s) => {
      const valor = serie.valores[i];
      const y0 = y(Math.max(valor, 0)), y1 = y(Math.min(valor, 0));
      elementos.push(
        criarSvg('rect', { x: inicio + s * larguraBarra + 1, y: y0, width: Math.max(larguraBarra - 2, 1), height: Math.max(y1 - y0, valor ? 1 : 0), rx: 2, class: serie.classe }, [
          criarSvg('title', {}, [`${rotulo} · ${serie.nome}: ${formatar(valor)}`]),
        ])
      );
    });
    if (i % saltoRotulo === 0) {
      elementos.push(criarSvg('text', { x: centro, y: A - baixo + 18, 'text-anchor': 'middle', class: 'eixo-texto' }, [rotulo]));
    }
  });
  let xLegenda = esq;
  for (const serie of series) {
    elementos.push(
      criarSvg('rect', { x: xLegenda, y: 10, width: 12, height: 12, rx: 2, class: serie.classe }),
      criarSvg('text', { x: xLegenda + 18, y: 20, class: 'legenda-texto' }, [serie.nome])
    );
    xLegenda += 30 + serie.nome.length * 7.5;
  }
  container.replaceChildren(criarSvg('svg', { viewBox: `0 0 ${L} ${A}`, role: 'img', 'aria-label': series.map((s) => s.nome).join(' e '), class: 'grafico' }, elementos));
}

export function barrasHorizontais(container, { itens, formatar, vazio, classe = 'serie-1' }) {
  if (!itens.length) {
    container.replaceChildren(criar('p', { className: 'vazio', textContent: vazio }));
    return;
  }
  const L = Math.max(320, Math.round(container.clientWidth) || 520), linha = 40, esq = Math.min(150, L * 0.3), dir = Math.min(170, L * 0.32);
  const A = itens.length * linha + 8;
  const maior = Math.max(...itens.map((i) => i.valor), 1);
  const elementos = [];
  itens.forEach((item, i) => {
    const yCentro = 4 + i * linha + linha / 2;
    const largura = Math.max(((L - esq - dir) * item.valor) / maior, 2);
    elementos.push(
      criarSvg('text', { x: esq - 10, y: yCentro + 4, 'text-anchor': 'end', class: 'rotulo-barra' }, [item.rotulo]),
      criarSvg('rect', { x: esq, y: yCentro - 11, width: largura, height: 22, rx: 3, class: classe }, [criarSvg('title', {}, [`${item.rotulo}: ${formatar(item.valor)}`])]),
      criarSvg('text', { x: esq + largura + 8, y: yCentro + 4, class: 'valor-barra' }, [`${formatar(item.valor)}${item.detalhe ? ` · ${item.detalhe}` : ''}`])
    );
  });
  container.replaceChildren(criarSvg('svg', { viewBox: `0 0 ${L} ${A}`, role: 'img', class: 'grafico' }, elementos));
}
