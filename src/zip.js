import zlib from 'node:zlib';

const JA_COMPRIMIDOS = /\.(png|jpe?g|webp|gif|zip)$/i;

function dataDos(data) {
  return {
    hora: (data.getHours() << 11) | (data.getMinutes() << 5) | Math.floor(data.getSeconds() / 2),
    dia: ((data.getFullYear() - 1980) << 9) | ((data.getMonth() + 1) << 5) | data.getDate(),
  };
}

export function criarZip(arquivos) {
  const partes = [];
  const central = [];
  let deslocamento = 0;

  for (const { nome, dados, data = new Date() } of arquivos) {
    const nomeBuf = Buffer.from(nome, 'utf8');
    const armazenar = JA_COMPRIMIDOS.test(nome);
    const conteudo = armazenar ? dados : zlib.deflateRawSync(dados);
    const metodo = armazenar ? 0 : 8;
    const crc = zlib.crc32(dados);
    const { hora, dia } = dataDos(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(conteudo.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    partes.push(local, nomeBuf, conteudo);

    const registro = Buffer.alloc(46);
    registro.writeUInt32LE(0x02014b50, 0);
    registro.writeUInt16LE(20, 4);
    registro.writeUInt16LE(20, 6);
    registro.writeUInt16LE(0x0800, 8);
    registro.writeUInt16LE(metodo, 10);
    registro.writeUInt16LE(hora, 12);
    registro.writeUInt16LE(dia, 14);
    registro.writeUInt32LE(crc, 16);
    registro.writeUInt32LE(conteudo.length, 20);
    registro.writeUInt32LE(dados.length, 24);
    registro.writeUInt16LE(nomeBuf.length, 28);
    registro.writeUInt32LE(deslocamento, 42);
    central.push(registro, nomeBuf);

    deslocamento += local.length + nomeBuf.length + conteudo.length;
  }

  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...partes, diretorio, fim]);
}
