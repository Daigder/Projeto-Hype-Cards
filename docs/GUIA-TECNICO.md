# Hype Cards — Guia técnico

Sistema web para controle de estoque de uma loja de produtos Pokémon TCG.
Gerencia **coleções**, **cartas avulsas**, **produtos selados** (boosters, ETBs, boxes…) e **acessórios** (sleeves, deck boxes, pastas…), com histórico de entradas e saídas, registro de vendas, controle de lucro e alerta de estoque baixo.

## Funcionalidades

- **Login com perfis**: *administrador* (acesso total) e *vendedor* (consulta e movimenta estoque, mas não cadastra, edita nem exclui).
- **Histórico de movimentações**: toda entrada e saída registra data, motivo (compra, venda, avaria, ajuste…), quantidade, estoque antes/depois, valor e usuário. Alterar a quantidade pela edição do cadastro também entra no histórico como ajuste.
- **Vendas com carrinho**: vários itens por venda, desconto em % ou R$ (rateado entre os itens), forma de pagamento, cliente, recibo para imprimir ou copiar e estorno que devolve os itens ao estoque.
- **Relatórios por período**: faturamento, lucro, ticket médio, descontos e estornos, com gráficos por mês ou por dia, por categoria e por forma de pagamento.
- **Preço de custo e de venda**: mostra o custo do estoque e o lucro potencial.
- **Fotos dos itens**: reduzidas automaticamente no navegador antes do envio (até 1000 px, formato WEBP).
- **Visualização em tabela ou grade** (vitrine com fotos), **ordenação** clicando no cabeçalho e **paginação**.
- **Exportação para CSV** (abre direto no Excel) das listas e do histórico, respeitando os filtros.
- **Backup** em um clique: baixa um `.zip` com o banco de dados e todas as imagens.
- **Modo claro e escuro**.

## Tecnologias

- **Node.js** (22.13 ou superior) com **Express 5**: API REST
- **PostgreSQL** (pacote `pg`) **ou SQLite** (módulo nativo `node:sqlite`): o sistema escolhe pelo `.env`. Com `DATABASE_URL` usa PostgreSQL; sem ela, SQLite em `data/hypecards.db`.
- **HTML, CSS e JavaScript** puros: interface web em `public/`
- **node:test**: testes automatizados da API, rodando nos dois bancos
- **GitHub Actions**: executa os testes a cada push (`.github/workflows/testes.yml`)

## Como executar

```bash
npm install
npm start
```

Acesse **http://localhost:3000**. A mensagem no terminal mostra qual banco está em uso.

> No Windows, se o PowerShell bloquear o `npm` ("execução de scripts foi desabilitada"), use `npm.cmd start`.

Use `npm run dev` para reiniciar o servidor automaticamente a cada alteração no código.

### Banco de dados: PostgreSQL ou SQLite

Sem nenhuma configuração, o sistema usa **SQLite**: um arquivo só (`data/hypecards.db`), sem nada para instalar.

Para usar **PostgreSQL**:

1. Instale o PostgreSQL e crie um banco vazio, por exemplo `hypecards` (no pgAdmin: *Databases → Create → Database*).
2. Copie `.env.example` para `.env` e ajuste a senha:
   ```
   DATABASE_URL=postgres://postgres:SUA_SENHA@localhost:5432/hypecards
   ```
   Se a senha tiver caracteres especiais (`@ # / : % ? &`), escreva-os codificados. Por exemplo, `@` vira `%40`.
3. Inicie com `npm start`. As tabelas são criadas automaticamente.

**Migrar os dados do SQLite para o PostgreSQL:**

```bash
npm run migrar                 # copia data/hypecards.db para o PostgreSQL vazio
npm run migrar -- --substituir # apaga o que houver no PostgreSQL e copia de novo
```

O script copia coleções, itens, usuários e histórico com os mesmos ids. As imagens continuam em `data/imagens/`, e cada usuário só precisa fazer login de novo.

### Primeiro acesso

Na primeira execução o banco é criado com dados de exemplo e um administrador:

| Usuário | Senha inicial |
|---------|---------------|
| `admin` | `admin123`    |

O sistema exige a troca da senha no primeiro login. Para definir outra senha inicial, inicie o servidor com a variável `ADMIN_SENHA_INICIAL`. Novos usuários são cadastrados na aba **Usuários**, que só administradores veem, e também precisam trocar a senha no primeiro acesso.

Para recomeçar do zero, apague a pasta `data/`.

## Testes

```bash
npm test
```

Os testes sobem a API com um banco e uma pasta de imagens temporários, sem mexer nos seus dados. Eles cobrem login e permissões, CRUD, validações, movimentações, vendas com carrinho e desconto, estorno, relatórios, resumo, ordenação e paginação, CSV, imagens, backup e a conversão de vendas antigas.

São 25 testes. Eles rodam sempre no **SQLite**. Se houver `DATABASE_URL` no `.env`, rodam também no **PostgreSQL**, usando um banco separado chamado `hypecards_teste`, criado e limpo automaticamente. O banco do sistema nunca é usado nos testes. Para escolher outro banco de teste, use a variável `TEST_DATABASE_URL`.

No GitHub, o workflow **Testes** roda a cada push na `main` e em pull requests, em Linux, com Node.js 22 e um PostgreSQL 16 de teste. O selo no topo do README mostra o resultado da última execução.

## Backup e restauração

O botão **⬇ Backup**, visível só para administradores, baixa `hypecards-backup-AAAA-MM-DD.zip` com:

- **SQLite:** `hypecards.db`, uma cópia consistente do banco feita mesmo com o sistema em uso
- **PostgreSQL:** `hypecards.sql`, gerado pelo `pg_dump` que vem com o PostgreSQL
- `imagens/`: fotos dos itens

Para restaurar, pare o servidor e extraia as `imagens/` dentro da pasta `data/`. Depois:

- **SQLite:** coloque o `hypecards.db` em `data/`, substituindo o atual.
- **PostgreSQL:** rode `psql "SUA_DATABASE_URL" -f hypecards.sql`. O script apaga e recria as tabelas.

No Windows, o `pg_dump` é encontrado automaticamente em `C:\Program Files\PostgreSQL`. Em outros sistemas ele precisa estar no PATH, ou indicado na variável `PG_DUMP`.

## Estrutura

```
├── public/              # Front-end (interface web)
│   ├── index.html       # Sistema
│   ├── login.html       # Tela de login
│   ├── login.js
│   ├── tema.js          # Modo claro/escuro
│   ├── style.css
│   └── js/              # Módulos da interface (ES modules)
│       ├── main.js      # Início, abas e sessão
│       ├── api.js / util.js / estado.js / componentes.js
│       ├── resumo.js · cadastros.js · formulario.js · movimentacoes.js
│       ├── vendas.js    # Carrinho, lista de vendas, recibo e estorno
│       ├── relatorios.js / graficos.js  # Relatórios e gráficos em SVG
│       └── sessao.js · recursos.js
├── src/
│   ├── server.js        # Inicia o servidor
│   ├── app.js           # Monta a aplicação Express e as rotas
│   ├── db.js            # Tabelas, atualizações de esquema e dados iniciais
│   ├── banco/           # Acesso ao banco: mesma interface para PostgreSQL e SQLite
│   │   ├── index.js     # Escolhe o banco e guarda as diferenças de SQL entre eles
│   │   ├── postgres.js
│   │   └── sqlite.js
│   ├── auth.js          # Login, sessões, perfis e cadastro de usuários
│   ├── senhas.js        # Hash de senhas (scrypt)
│   ├── crud.js          # Gerador de rotas CRUD, validação, ordenação e paginação
│   ├── recursos.js      # Definição das entidades e seus campos
│   ├── movimentacoes.js # Histórico de entradas e saídas
│   ├── vendas.js        # Vendas: carrinho, desconto, estorno, catálogo
│   ├── relatorios.js    # Relatórios por período
│   ├── resumo.js        # Indicadores do painel
│   ├── csv.js           # Exportação para CSV
│   ├── backup.js / zip.js
│   └── http.js          # Erros HTTP e utilitários de rota
├── scripts/
│   └── migrar-para-postgres.js  # Copia os dados do SQLite para o PostgreSQL
├── .github/workflows/   # Integração contínua (GitHub Actions)
├── test/                # Testes automatizados
├── .env.example         # Modelo de configuração (copie para .env)
└── data/                # Banco SQLite e imagens (gerados automaticamente, fora do git)
```

## Modelo de dados

| Tabela          | Campos principais                                                                                     |
|-----------------|-------------------------------------------------------------------------------------------------------|
| `colecoes`      | nome, sigla, serie, data_lancamento                                                                   |
| `cartas`        | nome, colecao_id → colecoes, numero, raridade, condicao, idioma, preco, custo, quantidade, estoque_minimo, imagem |
| `produtos`      | nome, colecao_id → colecoes, tipo, preco, custo, quantidade, estoque_minimo, imagem                   |
| `acessorios`    | nome, categoria, marca, preco, custo, quantidade, estoque_minimo, imagem                              |
| `vendas`        | cliente, forma_pagamento, subtotal, desconto, total, custo_total, situacao (concluida/estornada), observacao, usuario_nome, motivo_estorno, estornada_em, estornada_por |
| `venda_itens`   | venda_id → vendas, recurso, item_id, item_nome, quantidade, preco_unitario, desconto, total, custo_unitario |
| `movimentacoes` | recurso, item_id, item_nome, operacao, motivo, quantidade, quantidade_anterior, quantidade_nova, preco_unitario, custo_unitario, observacao, usuario_nome, venda_id |
| `usuarios`      | nome, usuario, senha_hash, perfil (admin/vendedor), ativo, trocar_senha                               |
| `sessoes`       | token_hash, usuario_id → usuarios, expira_em                                                          |

- Uma coleção que ainda tem cartas ou produtos vinculados não pode ser excluída.
- O histórico guarda uma cópia do nome do item e do usuário, para continuar legível depois de exclusões.
- Cada item vendido gera uma movimentação de saída ligada à venda (`venda_id`); o estorno gera as entradas correspondentes.
- Vendas registradas antes da tabela `vendas` existir são convertidas automaticamente na inicialização (forma de pagamento "Não informada").
- Senhas são guardadas com hash `scrypt` e as sessões guardam só o hash do token. Após 5 tentativas de login erradas, o acesso fica bloqueado por 1 minuto.

## API REST

Todas as rotas, exceto `/api/auth/login`, exigem login (cookie de sessão).
As rotas marcadas com 🔒 são só para administradores.

### Autenticação

| Método | Rota               | Descrição                                        |
|--------|--------------------|--------------------------------------------------|
| POST   | `/api/auth/login`  | `{ "usuario": "...", "senha": "..." }`           |
| POST   | `/api/auth/logout` | Encerra a sessão                                 |
| GET    | `/api/auth/eu`     | Usuário logado                                   |
| POST   | `/api/auth/senha`  | `{ "senha_atual": "...", "nova_senha": "..." }`  |

### Cadastros

Os recursos `colecoes`, `cartas`, `produtos` e `acessorios` têm as mesmas rotas:

| Método | Rota                             | Descrição                                   |
|--------|----------------------------------|---------------------------------------------|
| GET    | `/api/{recurso}`                 | Lista registros                             |
| GET    | `/api/{recurso}/exportar.csv`    | Exporta a lista em CSV                      |
| GET    | `/api/{recurso}/{id}`            | Busca um registro                           |
| POST   | `/api/{recurso}` 🔒              | Cria um registro                            |
| PUT    | `/api/{recurso}/{id}` 🔒         | Atualiza um registro                        |
| DELETE | `/api/{recurso}/{id}` 🔒         | Exclui um registro                          |

Parâmetros opcionais na listagem e no CSV:

- Filtros: `?busca=texto`, `?colecao_id=1` (cartas e produtos) e `?estoque_baixo=1`
- Ordenação: `?ordenar=preco&direcao=desc`
- Paginação: `?pagina=1&por_pagina=20`. O total de registros vem no cabeçalho `X-Total-Count`.

Rotas extras de `cartas`, `produtos` e `acessorios`:

| Método | Rota                                  | Descrição                                                    |
|--------|---------------------------------------|--------------------------------------------------------------|
| PATCH  | `/api/{recurso}/{id}/estoque`         | Entrada/saída de estoque (ver abaixo)                        |
| GET    | `/api/{recurso}/{id}/movimentacoes`   | Histórico do item                                            |
| PUT    | `/api/{recurso}/{id}/imagem` 🔒       | Envia a imagem (corpo = arquivo, `Content-Type: image/png`…) |
| DELETE | `/api/{recurso}/{id}/imagem` 🔒       | Remove a imagem                                              |

Movimentação de estoque:

```json
{ "operacao": "saida", "motivo": "Venda", "quantidade": 2, "preco_unitario": 40, "observacao": "Cliente balcão" }
```

- Motivos de entrada: `Compra`, `Devolução de cliente`, `Ajuste de inventário`
- Motivos de saída: `Venda`, `Avaria/Perda`, `Uso interno`, `Ajuste de inventário`

Em *Venda* e *Compra*, `preco_unitario` é opcional. Se não for enviado, a API usa o preço de venda ou de custo do cadastro. Uma saída com motivo *Venda* cria uma venda de um item só (aceita `forma_pagamento`; sem ela, fica "Não informada").

### Vendas

| Método | Rota                          | Descrição                                                                 |
|--------|-------------------------------|---------------------------------------------------------------------------|
| GET    | `/api/vendas`                 | Lista vendas. Filtros: `busca` (nº ou cliente), `forma_pagamento`, `situacao`, `de`, `ate`, além da paginação |
| POST   | `/api/vendas`                 | Registra uma venda com vários itens (ver abaixo)                         |
| GET    | `/api/vendas/catalogo`        | Busca itens das três categorias para o carrinho: `?busca=texto`         |
| GET    | `/api/vendas/{id}`            | Venda com os itens (usado no recibo)                                      |
| POST   | `/api/vendas/{id}/estorno` 🔒 | Estorna a venda e devolve os itens ao estoque: `{ "motivo": "..." }`     |

```json
{
  "itens": [
    { "recurso": "cartas", "item_id": 3, "quantidade": 2 },
    { "recurso": "acessorios", "item_id": 1, "quantidade": 1, "preco_unitario": 85 }
  ],
  "desconto": { "tipo": "percentual", "valor": 10 },
  "forma_pagamento": "Pix",
  "cliente": "João",
  "observacao": "Retirada na loja"
}
```

- `desconto.tipo`: `percentual` (0 a 100) ou `valor` (até o subtotal). O desconto é rateado entre os itens.
- Formas de pagamento: `Pix`, `Dinheiro`, `Cartão de débito`, `Cartão de crédito`.
- Se faltar saldo de qualquer item, a venda inteira é recusada e nada é gravado.

### Relatórios

`GET /api/relatorios?de=2026-01-01&ate=2026-10-31&agrupar=mes`

- Sem `de`/`ate`: últimos 12 meses até hoje. `agrupar`: `mes` (padrão) ou `dia` (períodos de até 92 dias).
- Resposta: `totais` (vendas, faturamento, lucro, descontos, unidades, ticket médio), `estornos`, `serie` (um ponto por mês ou dia, inclusive os sem venda), `categorias`, `pagamentos` e `maisVendidos`. Considera só vendas concluídas.

### Outras rotas

| Método | Rota                                 | Descrição                                                         |
|--------|--------------------------------------|-------------------------------------------------------------------|
| GET    | `/api/movimentacoes`                 | Histórico geral. Filtros: `busca`, `recurso`, `operacao`, `motivo`, `de`, `ate`, além da paginação |
| GET    | `/api/movimentacoes/exportar.csv`    | Histórico em CSV                                                  |
| GET    | `/api/resumo`                        | Totais, valores em estoque, vendas e lucro do mês, mais vendidos, estoque baixo |
| GET    | `/api/opcoes`                        | Raridades, condições, tipos, categorias, motivos e formas de pagamento |
| GET    | `/api/backup` 🔒                     | Baixa o backup `.zip`                                             |
| GET/POST/PUT/DELETE | `/api/usuarios` 🔒      | Cadastro de usuários                                              |

### Exemplo

```bash
# Faz login e guarda o cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" -d '{"usuario":"admin","senha":"SUA_SENHA"}'

# Registra a venda de 2 unidades da carta 1
curl -b cookies.txt -X PATCH http://localhost:3000/api/cartas/1/estoque \
  -H "Content-Type: application/json" -d '{"operacao":"saida","motivo":"Venda","quantidade":2}'
```
