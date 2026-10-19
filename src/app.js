import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBanco } from './db.js';
import { RECURSOS, OPCOES } from './recursos.js';
import { criarRotasCrud, ErroHttp, TAMANHO_MAX_IMAGEM } from './crud.js';
import { criarAutenticacao } from './auth.js';
import { criarRotasMovimentacoes } from './movimentacoes.js';
import { calcularResumo } from './resumo.js';
import { gerarBackup } from './backup.js';
import { criarRotasVendas } from './vendas.js';
import { criarRotasRelatorios } from './relatorios.js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function criarApp({
  databaseUrl,
  dbArquivo = path.join(RAIZ, 'data', 'hypecards.db'),
  pastaImagens = path.join(RAIZ, 'data', 'imagens'),
} = {}) {
  const db = await abrirBanco({ databaseUrl, arquivoSqlite: dbArquivo });
  const { carregarUsuario, exigirLogin, exigirAdmin, rotasAuth, rotasUsuarios } = criarAutenticacao(db);

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(RAIZ, 'public')));
  app.use(carregarUsuario);

  app.use('/api/auth', rotasAuth);

  app.use('/imagens', exigirLogin, express.static(pastaImagens));
  app.use('/api', exigirLogin);

  app.get('/api/opcoes', (req, res) => res.json(OPCOES));
  app.get('/api/resumo', async (req, res) => res.json(await calcularResumo(db)));
  app.use('/api/movimentacoes', criarRotasMovimentacoes(db));
  app.use('/api/usuarios', rotasUsuarios);
  app.use('/api/vendas', criarRotasVendas(db, { exigirAdmin }));
  app.use('/api/relatorios', criarRotasRelatorios(db));

  app.get('/api/backup', exigirAdmin, async (req, res) => {
    const zip = await gerarBackup(db, pastaImagens);
    const data = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="hypecards-backup-${data}.zip"`);
    res.send(zip);
  });

  for (const [rota, recurso] of Object.entries(RECURSOS)) {
    app.use(`/api/${rota}`, criarRotasCrud(db, recurso, { pastaImagens, exigirAdmin }));
  }

  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  app.use((erro, req, res, next) => {
    if (erro instanceof ErroHttp) return res.status(erro.status).json({ erro: erro.message });
    if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
    if (erro.type === 'entity.too.large') {
      return res.status(413).json({ erro: `Arquivo muito grande. O tamanho máximo é ${TAMANHO_MAX_IMAGEM.toUpperCase()}.` });
    }

    const mensagem = `${erro.message} ${erro.constraint ?? ''}`;
    if (['23001', '23503'].includes(erro.code) || mensagem.includes('FOREIGN KEY constraint failed')) {
      return res.status(409).json({
        erro: 'Operação não permitida: a coleção não existe ou ainda possui cartas/produtos vinculados.',
      });
    }
    const duplicado = erro.code === '23505' || mensagem.includes('UNIQUE constraint failed');
    if (duplicado && /usuarios\.usuario|usuarios_login_unico/.test(mensagem)) {
      return res.status(409).json({ erro: 'Já existe um usuário com esse login.' });
    }
    if (duplicado) {
      return res.status(409).json({ erro: 'Já existe um registro com esse nome.' });
    }

    console.error(erro);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  });

  return { app, db };
}
