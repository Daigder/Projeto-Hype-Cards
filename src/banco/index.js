import { conectarSqlite } from './sqlite.js';
import { conectarPostgres } from './postgres.js';

const DIALETOS = {
  sqlite: {
    like: 'LIKE',
    semCaixa: (expressao) => `${expressao} COLLATE NOCASE`,
    inicioDoMes: "date('now', 'localtime', 'start of month')",
    diaSeguinte: (parametro) => `date(${parametro}, '+1 day')`,
    bloquearLinha: '',
    agora: "datetime('now', 'localtime')",
    chaveMes: (coluna) => `strftime('%Y-%m', ${coluna})`,
    chaveDia: (coluna) => `date(${coluna})`,
  },
  postgres: {
    like: 'ILIKE',
    semCaixa: (expressao) => `lower(${expressao})`,
    inicioDoMes: "date_trunc('month', LOCALTIMESTAMP)",
    diaSeguinte: (parametro) => `(${parametro}::date + 1)`,
    bloquearLinha: ' FOR UPDATE OF t',
    agora: 'LOCALTIMESTAMP(0)',
    chaveMes: (coluna) => `to_char(${coluna}, 'YYYY-MM')`,
    chaveDia: (coluna) => `to_char(${coluna}, 'YYYY-MM-DD')`,
  },
};

export function conectarBanco({ databaseUrl, arquivoSqlite }) {
  const banco = databaseUrl ? conectarPostgres(databaseUrl) : conectarSqlite(arquivoSqlite);
  return { ...banco, sql: DIALETOS[banco.dialeto] };
}
