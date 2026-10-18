# Hype Cards — Controle de Estoque Pokémon TCG

Sistema web para controle de estoque de uma loja de produtos Pokémon TCG.
Gerencia **coleções**, **cartas avulsas**, **produtos selados** (boosters, ETBs, boxes…) e **acessórios** (sleeves, deck boxes, pastas…), com histórico de entradas e saídas, registro de vendas, controle de lucro e alerta de estoque baixo.

## Funcionalidades

- **Login com perfis**: *administrador* (acesso total) e *vendedor* (consulta e movimenta estoque, mas não cadastra, edita nem exclui).
- **Histórico de movimentações**: toda entrada e saída registra data, motivo (compra, venda, avaria, ajuste…), quantidade, estoque antes/depois, valor e usuário. Alterar a quantidade pela edição do cadastro também entra no histórico como ajuste.
- **Vendas e lucro**: saídas com motivo *Venda* guardam o preço cobrado e o custo do item, e o resumo mostra o faturamento, o lucro e os itens mais vendidos do mês.
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

Os testes sobem a API com um banco e uma pasta de imagens temporários, sem mexer nos seus dados. Eles cobrem login e permissões, CRUD, validações, movimentações e vendas, resumo, ordenação e paginação, CSV, imagens e backup.

Os testes rodam sempre no **SQLite**. Se houver `DATABASE_URL` no `.env`, rodam também no **PostgreSQL**, usando um banco separado chamado `hypecards_teste`, criado e limpo automaticamente. O banco do sistema nunca é usado nos testes. Para escolher outro banco de teste, use a variável `TEST_DATABASE_URL`.

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
│   ├── app.js / login.js
│   ├── tema.js          # Modo claro/escuro
│   └── style.css
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
│   ├── resumo.js        # Indicadores do painel
│   ├── csv.js           # Exportação para CSV
│   ├── backup.js / zip.js
│   └── http.js          # Erros HTTP e utilitários de rota
├── scripts/
│   └── migrar-para-postgres.js  # Copia os dados do SQLite para o PostgreSQL
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
| `movimentacoes` | recurso, item_id, item_nome, operacao, motivo, quantidade, quantidade_anterior, quantidade_nova, preco_unitario, custo_unitario, observacao, usuario_nome |
| `usuarios`      | nome, usuario, senha_hash, perfil (admin/vendedor), ativo, trocar_senha                               |
| `sessoes`       | token_hash, usuario_id → usuarios, expira_em                                                          |

- Uma coleção que ainda tem cartas ou produtos vinculados não pode ser excluída.
- O histórico guarda uma cópia do nome do item e do usuário, para continuar legível depois de exclusões.
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

Em *Venda* e *Compra*, `preco_unitario` é opcional. Se não for enviado, a API usa o preço de venda ou de custo do cadastro.

### Outras rotas

| Método | Rota                                 | Descrição                                                         |
|--------|--------------------------------------|-------------------------------------------------------------------|
| GET    | `/api/movimentacoes`                 | Histórico geral. Filtros: `busca`, `recurso`, `operacao`, `motivo`, `de`, `ate`, além da paginação |
| GET    | `/api/movimentacoes/exportar.csv`    | Histórico em CSV                                                  |
| GET    | `/api/resumo`                        | Totais, valores em estoque, vendas e lucro do mês, mais vendidos, estoque baixo |
| GET    | `/api/opcoes`                        | Raridades, condições, tipos, categorias e motivos                 |
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
