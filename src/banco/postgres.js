import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Ajusta os tipos que o PostgreSQL devolve para ficarem iguais aos do SQLite:
pg.types.setTypeParser(20, Number); // bigint (COUNT, SUM de inteiros) → número, não texto
pg.types.setTypeParser(1700, Number); // numeric → número
pg.types.setTypeParser(1114, (texto) => texto); // timestamp → "AAAA-MM-DD HH:MM:SS", não Date

// O código usa "?" como marcador (padrão do SQLite); o PostgreSQL espera $1, $2...
function converterMarcadores(sql) {
  let numero = 0;
  let dentroDeTexto = false;
  let resultado = '';
  for (const caractere of sql) {
    if (caractere === "'") dentroDeTexto = !dentroDeTexto;
    resultado += caractere === '?' && !dentroDeTexto ? `$${++numero}` : caractere;
  }
  return resultado;
}

function criarOperacoes(cliente) {
  const consultar = async (sql, params = []) => (await cliente.query(converterMarcadores(sql), params)).rows;
  return {
    consultar,
    um: async (sql, params = []) => (await consultar(sql, params))[0],
    executar: async (sql, params = []) => ({ alteradas: (await cliente.query(converterMarcadores(sql), params)).rowCount }),
    executarScript: async (sql) => {
      await cliente.query(sql);
    },
  };
}

// Procura o pg_dump (usado no backup): variável PG_DUMP, PATH ou a instalação padrão do Windows
function localizarPgDump() {
  if (process.env.PG_DUMP) return process.env.PG_DUMP;
  const pastaWindows = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
  if (process.platform === 'win32' && fs.existsSync(pastaWindows)) {
    const versoes = fs.readdirSync(pastaWindows).sort((a, b) => Number(b) - Number(a));
    for (const versao of versoes) {
      const caminho = path.join(pastaWindows, versao, 'bin', 'pg_dump.exe');
      if (fs.existsSync(caminho)) return caminho;
    }
  }
  return 'pg_dump';
}

export function conectarPostgres(url) {
  const pool = new pg.Pool({ connectionString: url, max: 10 });

  return {
    dialeto: 'postgres',
    ...criarOperacoes(pool),

    // Cada transação usa uma conexão própria do pool
    async transacao(executar) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await executar(criarOperacoes(cliente));
        await cliente.query('COMMIT');
        return resultado;
      } catch (erro) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw erro;
      } finally {
        cliente.release();
      }
    },

    // Backup em SQL puro (restaurável com psql), gerado pelo pg_dump que vem com o PostgreSQL
    async gerarCopia() {
      const resultado = spawnSync(localizarPgDump(), ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', url], {
        maxBuffer: 1024 * 1024 * 1024,
      });
      if (resultado.error || resultado.status !== 0) {
        const detalhe = resultado.error?.message ?? resultado.stderr.toString().trim();
        throw new Error(`Não foi possível gerar o backup com o pg_dump: ${detalhe}`);
      }
      return { nome: 'hypecards.sql', dados: resultado.stdout };
    },

    fechar: () => pool.end(),
  };
}
