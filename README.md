# Hype Cards — Controle de Estoque Pokémon TCG

Sistema web para controle de estoque de uma loja de produtos Pokémon TCG.
Permite gerenciar **coleções**, **cartas avulsas**, **produtos selados** (boosters, ETBs, boxes…) e **acessórios** (sleeves, deck boxes, pastas…), com entrada/saída de estoque e alerta de estoque baixo.

## Tecnologias

- **Node.js** (22.13 ou superior) com **Express 5**: API REST
- **SQLite** (módulo nativo `node:sqlite`): banco de dados relacional salvo em `data/hypecards.db`
- **HTML, CSS e JavaScript** puros: interface web em `public/`

## Como executar

```bash
npm install
npm start
```

Acesse **http://localhost:3000**.

Na primeira execução o banco é criado automaticamente com alguns dados de exemplo.
Para recomeçar do zero, apague o arquivo `data/hypecards.db`.

Use `npm run dev` para reiniciar o servidor automaticamente a cada alteração no código.

## Estrutura

```
├── public/            # Front-end (interface web)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   ├── server.js      # Servidor Express e rotas gerais
│   ├── db.js          # Conexão, criação das tabelas e dados iniciais
│   ├── crud.js        # Gerador de rotas CRUD e validação
│   └── recursos.js    # Definição das entidades e seus campos
└── data/              # Arquivo do banco SQLite (gerado automaticamente)
```

## Modelo de dados

| Tabela       | Campos principais                                                                 |
|--------------|-----------------------------------------------------------------------------------|
| `colecoes`   | nome, sigla, serie, data_lancamento                                               |
| `cartas`     | nome, colecao_id → colecoes, numero, raridade, condicao, idioma, preco, quantidade, estoque_minimo |
| `produtos`   | nome, colecao_id → colecoes, tipo, preco, quantidade, estoque_minimo              |
| `acessorios` | nome, categoria, marca, preco, quantidade, estoque_minimo                         |

Uma coleção que ainda tem cartas ou produtos vinculados não pode ser excluída.

## API REST

Os recursos `colecoes`, `cartas`, `produtos` e `acessorios` têm as mesmas rotas:

| Método | Rota                      | Descrição                       |
|--------|---------------------------|---------------------------------|
| GET    | `/api/{recurso}`          | Lista registros (Read)          |
| GET    | `/api/{recurso}/{id}`     | Busca um registro (Read)        |
| POST   | `/api/{recurso}`          | Cria um registro (Create)       |
| PUT    | `/api/{recurso}/{id}`     | Atualiza um registro (Update)   |
| DELETE | `/api/{recurso}/{id}`     | Exclui um registro (Delete)     |

Filtros opcionais na listagem: `?busca=texto`, `?colecao_id=1` (cartas e produtos) e `?estoque_baixo=1`.

Rotas extras:

| Método | Rota                              | Descrição                                                     |
|--------|-----------------------------------|---------------------------------------------------------------|
| PATCH  | `/api/{recurso}/{id}/estoque`     | Entrada/saída de estoque: `{ "operacao": "entrada", "quantidade": 5 }` |
| GET    | `/api/resumo`                     | Totais, valor em estoque e itens abaixo do mínimo             |
| GET    | `/api/opcoes`                     | Listas de raridades, condições, tipos e categorias            |

### Exemplo

```bash
curl -X POST http://localhost:3000/api/cartas \
  -H "Content-Type: application/json" \
  -d '{"nome":"Gengar ex","colecao_id":1,"raridade":"Double Rare (ex)","preco":30,"quantidade":4,"estoque_minimo":2}'
```
