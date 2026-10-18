import { conectarSqlite } from './sqlite.js';
import { conectarPostgres } from './postgres.js';

// Trechos de SQL que mudam de um banco para o outro
const DIALETOS = {
  sqlite: {
    like: 'LIKE', // no SQLite o LIKE já ignora maiúsculas/minúsculas
    semCaixa: (expressao) => `${expressao} COLLATE NOCASE`,
    inicioDoMes: "date('now', 'localtime', 'start of month')",
    diaSeguinte: (parametro) => `date(${parametro}, '+1 day')`,
    bloquearLinha: '',
  },
  postgres: {
    like: 'ILIKE',
    semCaixa: (expressao) => `lower(${expressao})`,
    inicioDoMes: "date_trunc('month', LOCALTIMESTAMP)",
    diaSeguinte: (parametro) => `(${parametro}::date + 1)`,
    bloquearLinha: ' FOR UPDATE OF t', // trava o item durante a movimentação de estoque
  },
};

// Interface comum aos dois bancos (tudo assíncrono, marcadores "?"):
//   consultar(sql, params) → linhas · um(sql, params) → linha ou undefined
//   executar(sql, params) → { alteradas } · executarScript(sql) · transacao(async (tx) => ...)
//   gerarCopia() → { nome, dados } para o backup · fechar()
export function conectarBanco({ databaseUrl, arquivoSqlite }) {
  const banco = databaseUrl ? conectarPostgres(databaseUrl) : conectarSqlite(arquivoSqlite);
  return { ...banco, sql: DIALETOS[banco.dialeto] };
}
