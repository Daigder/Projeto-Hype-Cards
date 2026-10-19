import fs from 'node:fs';
import path from 'node:path';
import { criarZip } from './zip.js';

export async function gerarBackup(db, pastaImagens) {
  const arquivos = [await db.gerarCopia()];
  if (fs.existsSync(pastaImagens)) {
    for (const nome of fs.readdirSync(pastaImagens)) {
      const caminho = path.join(pastaImagens, nome);
      const info = fs.statSync(caminho);
      if (info.isFile()) arquivos.push({ nome: `imagens/${nome}`, dados: fs.readFileSync(caminho), data: info.mtime });
    }
  }
  return criarZip(arquivos);
}
