// Copia todos os dados do SQLite (data/hypecards.db) para o PostgreSQL da DATABASE_URL.
//
//   npm run migrar                → copia para um PostgreSQL vazio
//   npm run migrar -- --substituir → apaga o que houver no PostgreSQL e copia de novo
//
// As imagens continuam na pasta data/imagens (o banco guarda só o nome do arquivo).
// As sessões não são copiadas: cada usuário só precisa entrar de novo.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { abrirBanco } from '../src/db.js';
import { RAIZ } from '../src/app.js';

try {
  process.loadEnvFile();
} catch {}

// A ordem importa: coleções antes dos itens (chave estrangeira)
const TABELAS = ['colecoes', 'cartas', 'produtos', 'acessorios', 'usuarios', 'movimentacoes'];
const substituir = process.argv.includes('--substituir');
const arquivoSqlite = process.env.DB_ARQUIVO || path.join(RAIZ, 'data', 'hypecards.db');

if (!process.env.DATABASE_URL) {
  console.error('Configure a DATABASE_URL no arquivo .env antes de migrar.');
  process.exit(1);
}
if (!fs.existsSync(arquivoSqlite)) {
  console.error(`Banco SQLite não encontrado: ${arquivoSqlite}`);
  process.exit(1);
}

// Abre o SQLite pela própria camada do sistema (aplica as atualizações de esquema), depois lê direto
const sqliteAtualizado = await abrirBanco({ arquivoSqlite, dadosIniciais: false });
await sqliteAtualizado.fechar();
const origem = new DatabaseSync(arquivoSqlite, { readOnly: true });
const destino = await abrirBanco({ databaseUrl: process.env.DATABASE_URL, dadosIniciais: false });

try {
  const ocupadas = [];
  for (const tabela of TABELAS) {
    const { total } = await destino.um(`SELECT COUNT(*) AS total FROM ${tabela}`);
    if (total > 0) ocupadas.push(`${tabela} (${total})`);
  }
  if (ocupadas.length && !substituir) {
    console.error(`O PostgreSQL já tem dados em: ${ocupadas.join(', ')}.`);
    console.error('Para apagar esses dados e copiar de novo, rode: npm run migrar -- --substituir');
    process.exitCode = 1;
  } else {
    await destino.transacao(async (tx) => {
      if (ocupadas.length) {
        await tx.executarScript(`TRUNCATE ${TABELAS.join(', ')}, sessoes RESTART IDENTITY CASCADE`);
      }
      for (const tabela of TABELAS) {
        // Copia só as colunas que existem nos dois bancos
        const colunasDestino = (
          await tx.consultar('SELECT column_name FROM information_schema.columns WHERE table_name = ?', [tabela])
        ).map((c) => c.column_name);
        const colunas = origem
          .prepare(`PRAGMA table_info(${tabela})`)
          .all()
          .map((c) => c.name)
          .filter((c) => colunasDestino.includes(c));

        const linhas = origem.prepare(`SELECT ${colunas.join(', ')} FROM ${tabela} ORDER BY id`).all();
        const inserir = `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`;
        for (const linha of linhas) {
          await tx.executar(inserir, colunas.map((c) => linha[c]));
        }

        // Os ids foram copiados: o próximo id gerado precisa continuar depois do maior
        await tx.consultar(
          `SELECT setval(pg_get_serial_sequence('${tabela}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${tabela}`
        );
        console.log(`${tabela.padEnd(14)} ${linhas.length} registro(s)`);
      }
    });
    console.log('\nMigração concluída. Inicie o sistema com "npm start" (ele vai usar o PostgreSQL do .env).');
  }
} finally {
  origem.close();
  await destino.fechar();
}
