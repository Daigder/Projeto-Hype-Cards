import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBanco } from './db.js';
import { RECURSOS, OPCOES } from './recursos.js';
import { criarRotasCrud, ErroHttp } from './crud.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = abrirBanco(process.env.DB_ARQUIVO || path.join(raiz, 'data', 'hypecards.db'));

const app = express();
app.use(express.json());
app.use(express.static(path.join(raiz, 'public')));

app.get('/api/opcoes', (req, res) => res.json(OPCOES));

// Painel: totais por categoria, valor em estoque e itens abaixo do estoque mínimo
app.get('/api/resumo', (req, res) => {
  const totais = (tabela) =>
    db
      .prepare(
        `SELECT COUNT(*) AS itens,
                COALESCE(SUM(quantidade), 0) AS unidades,
                COALESCE(SUM(quantidade * preco), 0) AS valor,
                COALESCE(SUM(quantidade <= estoque_minimo), 0) AS estoque_baixo
         FROM ${tabela}`
      )
      .get();

  const estoqueBaixo = db
    .prepare(
      `SELECT 'cartas' AS recurso, id, nome, quantidade, estoque_minimo FROM cartas WHERE quantidade <= estoque_minimo
       UNION ALL
       SELECT 'produtos', id, nome, quantidade, estoque_minimo FROM produtos WHERE quantidade <= estoque_minimo
       UNION ALL
       SELECT 'acessorios', id, nome, quantidade, estoque_minimo FROM acessorios WHERE quantidade <= estoque_minimo
       ORDER BY quantidade, nome`
    )
    .all();

  res.json({
    colecoes: db.prepare('SELECT COUNT(*) AS total FROM colecoes').get().total,
    cartas: totais('cartas'),
    produtos: totais('produtos'),
    acessorios: totais('acessorios'),
    estoqueBaixo,
  });
});

for (const [rota, recurso] of Object.entries(RECURSOS)) {
  app.use(`/api/${rota}`, criarRotasCrud(db, recurso));
}

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.use((erro, req, res, next) => {
  if (erro instanceof ErroHttp) return res.status(erro.status).json({ erro: erro.message });
  if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });

  const mensagem = String(erro.message);
  if (mensagem.includes('FOREIGN KEY constraint failed')) {
    return res.status(409).json({
      erro: 'Operação não permitida: a coleção não existe ou ainda possui cartas/produtos vinculados.',
    });
  }
  if (mensagem.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ erro: 'Já existe um registro com esse nome.' });
  }

  console.error(erro);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
  console.log(`Hype Cards rodando em http://localhost:${PORTA}`);
});
