function formatarValor(valor, tipo) {
  if (valor === null || valor === undefined) return '';
  if (tipo === 'numero' && typeof valor === 'number') return valor.toFixed(2).replace('.', ',');
  const texto = String(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function gerarCsv(linhas, colunas) {
  const cabecalho = colunas.map((c) => formatarValor(c.rotulo)).join(';');
  const corpo = linhas.map((linha) => colunas.map((c) => formatarValor(linha[c.chave], c.tipo)).join(';'));
  return '\uFEFF' + [cabecalho, ...corpo].join('\r\n') + '\r\n';
}

export function enviarCsv(res, nomeBase, conteudo) {
  const data = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeBase}-${data}.csv"`);
  res.send(conteudo);
}
