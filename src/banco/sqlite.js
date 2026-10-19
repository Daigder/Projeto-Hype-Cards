import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export function conectarSqlite(arquivo) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec('PRAGMA foreign_keys = ON;');

  let fila = Promise.resolve();
  let ativa = null;
  const livre = async () => {
    while (ativa) await ativa;
  };

  const operacoes = {
    consultar: async (sql, params = []) => db.prepare(sql).all(...params),
    um: async (sql, params = []) => db.prepare(sql).get(...params),
    executar: async (sql, params = []) => ({ alteradas: Number(db.prepare(sql).run(...params).changes) }),
    executarScript: async (sql) => db.exec(sql),
  };

  const foraDeTransacao = Object.fromEntries(
    Object.entries(operacoes).map(([nome, operacao]) => [
      nome,
      async (...args) => {
        await livre();
        return operacao(...args);
      },
    ])
  );

  return {
    dialeto: 'sqlite',
    ...foraDeTransacao,

    transacao(executar) {
      const execucao = fila.then(async () => {
        await livre();
        let terminar;
        ativa = new Promise((ok) => (terminar = ok));
        db.exec('BEGIN');
        try {
          const resultado = await executar(operacoes);
          db.exec('COMMIT');
          return resultado;
        } catch (erro) {
          db.exec('ROLLBACK');
          throw erro;
        } finally {
          ativa = null;
          terminar();
        }
      });
      fila = execucao.catch(() => {});
      return execucao;
    },

    async gerarCopia() {
      await livre();
      const copia = path.join(os.tmpdir(), `hypecards-${crypto.randomUUID()}.db`);
      try {
        db.prepare('VACUUM INTO ?').run(copia);
        return { nome: 'hypecards.db', dados: fs.readFileSync(copia) };
      } finally {
        fs.rmSync(copia, { force: true });
      }
    },

    async fechar() {
      await livre();
      db.close();
    },
  };
}
