import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const ESQUEMA = `
  CREATE TABLE IF NOT EXISTS colecoes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT    NOT NULL UNIQUE,
    sigla           TEXT,
    serie           TEXT,
    data_lancamento TEXT,
    criado_em       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS cartas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT    NOT NULL,
    colecao_id     INTEGER NOT NULL REFERENCES colecoes(id) ON DELETE RESTRICT,
    numero         TEXT,
    raridade       TEXT,
    condicao       TEXT,
    idioma         TEXT,
    preco          REAL    NOT NULL DEFAULT 0 CHECK (preco >= 0),
    quantidade     INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    criado_em      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT    NOT NULL,
    colecao_id     INTEGER NOT NULL REFERENCES colecoes(id) ON DELETE RESTRICT,
    tipo           TEXT    NOT NULL,
    preco          REAL    NOT NULL DEFAULT 0 CHECK (preco >= 0),
    quantidade     INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    criado_em      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS acessorios (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nome           TEXT    NOT NULL,
    categoria      TEXT    NOT NULL,
    marca          TEXT,
    preco          REAL    NOT NULL DEFAULT 0 CHECK (preco >= 0),
    quantidade     INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    criado_em      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`;

export function abrirBanco(arquivo) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(ESQUEMA);
  popularDadosIniciais(db);
  return db;
}

// Insere alguns registros de exemplo na primeira execução (banco vazio)
function popularDadosIniciais(db) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM colecoes').get();
  if (total > 0) return;

  const novaColecao = db.prepare(
    'INSERT INTO colecoes (nome, sigla, serie, data_lancamento) VALUES (?, ?, ?, ?)'
  );
  const novaCarta = db.prepare(
    `INSERT INTO cartas (nome, colecao_id, numero, raridade, condicao, idioma, preco, quantidade, estoque_minimo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const novoProduto = db.prepare(
    `INSERT INTO produtos (nome, colecao_id, tipo, preco, quantidade, estoque_minimo)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const novoAcessorio = db.prepare(
    `INSERT INTO acessorios (nome, categoria, marca, preco, quantidade, estoque_minimo)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  db.exec('BEGIN');
  try {
    const svi = novaColecao.run('Escarlate e Violeta', 'SVI', 'Escarlate e Violeta', '2023-03-31').lastInsertRowid;
    const mew = novaColecao.run('151', 'MEW', 'Escarlate e Violeta', '2023-09-22').lastInsertRowid;
    const pre = novaColecao.run('Evoluções Prismáticas', 'PRE', 'Escarlate e Violeta', '2025-01-17').lastInsertRowid;

    novaCarta.run('Charizard ex', mew, '199/165', 'Special Illustration Rare', 'Near Mint (NM)', 'Inglês', 1200, 2, 1);
    novaCarta.run('Mew ex', mew, '151/165', 'Double Rare (ex)', 'Near Mint (NM)', 'Português', 45, 6, 3);
    novaCarta.run('Pikachu', mew, '025/165', 'Comum', 'Near Mint (NM)', 'Português', 3, 8, 10);
    novaCarta.run('Umbreon ex', pre, '161/131', 'Special Illustration Rare', 'Near Mint (NM)', 'Inglês', 2500, 1, 1);

    novoProduto.run('Booster 151', mew, 'Booster', 35, 48, 24);
    novoProduto.run('ETB Evoluções Prismáticas', pre, 'Elite Trainer Box', 650, 3, 5);
    novoProduto.run('Booster Box Escarlate e Violeta', svi, 'Booster Display (Box)', 900, 2, 1);

    novoAcessorio.run('Sleeves Matte Preto (100 un.)', 'Sleeves', 'Dragon Shield', 90, 15, 10);
    novoAcessorio.run('Deck Box Alcove Flip', 'Deck Box', 'Ultra Pro', 60, 4, 5);
    novoAcessorio.run('Pasta 9 bolsos', 'Pasta/Binder', 'Ultra Pro', 150, 6, 2);
    novoAcessorio.run('Toploader 3x4 (25 un.)', 'Toploader', 'Ultra Pro', 25, 30, 10);
    db.exec('COMMIT');
  } catch (erro) {
    db.exec('ROLLBACK');
    throw erro;
  }
}
