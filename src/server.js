import { criarApp } from './app.js';

// Lê o arquivo .env (se existir). Com DATABASE_URL o sistema usa PostgreSQL; sem ela, SQLite.
try {
  process.loadEnvFile();
} catch {}

const { app, db } = await criarApp({
  databaseUrl: process.env.DATABASE_URL || undefined,
  dbArquivo: process.env.DB_ARQUIVO || undefined,
  pastaImagens: process.env.PASTA_IMAGENS || undefined,
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  const banco = db.dialeto === 'postgres' ? 'PostgreSQL' : 'SQLite';
  console.log(`Hype Cards rodando em http://localhost:${PORTA} (banco: ${banco})`);
});
