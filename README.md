# 🃏 Hype Cards — Controle de Estoque Pokémon TCG ⚡

Este projeto é um sistema web para controlar o estoque de uma loja de produtos **Pokémon TCG** (Trading Card Game). Ele permite cadastrar **coleções**, **cartas avulsas**, **produtos selados** (boosters, ETBs, displays) e **acessórios** (sleeves, deck boxes, pastas), registrar cada entrada, saída e venda com data, valor e responsável, e acompanhar o faturamento e o lucro do mês. É ideal para lojas e colecionadores que querem sair das planilhas e ter controle real do estoque.

---
## Imagem da Página Inicial do Projeto
![Página inicial do Hype Cards: painel de resumo com vendas e lucro do mês, valor do estoque e itens com estoque baixo](docs/imagens/tela-resumo.png)

## 🛠️ Funcionalidades

1. **Gerenciamento do Estoque**
   - Cadastro de coleções, cartas (raridade, condição, idioma), produtos selados e acessórios.
   - Foto de cada item, reduzida automaticamente no navegador antes do envio.
   - Preço de venda, preço de custo, quantidade e estoque mínimo por item.
   - Edição e exclusão de itens.

2. **Movimentações e Vendas**
   - Registro de entradas (compra, devolução, ajuste) e saídas (venda, avaria, uso interno, ajuste).
   - Prévia do saldo antes de confirmar (ex.: *Estoque: 6 → 4 · Total: R$ 90,00*).
   - Histórico completo com data, motivo, valor e usuário responsável.
   - O estoque nunca fica negativo, mesmo com duas vendas ao mesmo tempo.

3. **Painel de Resumo**
   - Vendas, lucro e margem do mês.
   - Valor e custo do estoque e lucro potencial.
   - Itens mais vendidos e alerta de estoque baixo.

4. **Busca e Relatórios**
   - Busca por nome e filtros por coleção, estoque baixo, tipo de item, motivo e período.
   - Ordenação por coluna, paginação e visualização em tabela ou em grade com fotos.
   - Exportação das listas e do histórico para CSV (abre direto no Excel).

5. **Usuários e Segurança**
   - Login com dois perfis: **administrador** (acesso total) e **vendedor** (consulta e movimenta o estoque).
   - Senhas criptografadas, troca obrigatória no primeiro acesso e bloqueio após 5 tentativas erradas.
   - Backup em um clique: um arquivo ZIP com o banco de dados e todas as fotos.
   - Modo claro e escuro.

---

## 📂 Estrutura do Projeto

O sistema segue a arquitetura **cliente-servidor em camadas**:

- **Interface (`public/`):** telas em HTML, CSS e JavaScript que conversam com a API.
- **API (`src/`):** servidor Express com as regras de negócio: cadastros, movimentações, login, resumo, CSV e backup.
- **Acesso a dados (`src/banco/`):** a mesma interface para **PostgreSQL** ou **SQLite**, escolhida pelo arquivo `.env`.

```
├── public/        # Telas: sistema, login, tema claro/escuro
├── src/
│   ├── banco/     # Acesso ao PostgreSQL e ao SQLite
│   ├── app.js     # Monta a API e as rotas
│   ├── auth.js    # Login, sessões, perfis e usuários
│   ├── crud.js    # Cadastros, ordenação, paginação e imagens
│   └── ...        # Movimentações, resumo, CSV, backup
├── scripts/       # Migração do SQLite para o PostgreSQL
├── test/          # Testes automatizados da API
└── docs/          # Documentação (PDF), guia técnico e imagens
```

---

## 📋 Requisitos do Sistema

### Dados a Gerenciar

- **Coleções:** nome, sigla, série e data de lançamento.
- **Cartas:** coleção, número, raridade, condição, idioma, preços, quantidade, estoque mínimo e foto.
- **Produtos selados:** coleção, tipo, preços, quantidade, estoque mínimo e foto.
- **Acessórios:** categoria, marca, preços, quantidade, estoque mínimo e foto.
- **Movimentações:** item, operação, motivo, quantidade, valor, usuário e data.
- **Usuários:** nome, login, perfil e senha (guardada só como hash).

### Funcionalidades

- Cadastro, edição e remoção de coleções, cartas, produtos e acessórios.
- Registro de entradas, saídas e vendas com histórico auditável.
- Painel com vendas, lucro e alerta de estoque baixo.
- Busca, filtros, exportação CSV e backup.

A lista completa (18 requisitos funcionais e 12 não funcionais), com os diagramas UML e o DER, está na [documentação do projeto](docs/Hype%20Cards%20-%20Documentacao.pdf).

---

## 🔧 Tecnologias Utilizadas

<p align="center">
  <a href="https://nodejs.org/"><img src="https://skillicons.dev/icons?i=nodejs" height="48" alt="Node.js" title="Node.js"/></a>
  <a href="https://expressjs.com/"><img src="https://skillicons.dev/icons?i=express" height="48" alt="Express" title="Express"/></a>
  <a href="https://www.postgresql.org/"><img src="https://skillicons.dev/icons?i=postgres" height="48" alt="PostgreSQL" title="PostgreSQL"/></a>
  <a href="https://www.sqlite.org/"><img src="https://skillicons.dev/icons?i=sqlite" height="48" alt="SQLite" title="SQLite"/></a>
  <a href="https://developer.mozilla.org/pt-BR/docs/Web/HTML"><img src="https://skillicons.dev/icons?i=html" height="48" alt="HTML5" title="HTML5"/></a>
  <a href="https://developer.mozilla.org/pt-BR/docs/Web/CSS"><img src="https://skillicons.dev/icons?i=css" height="48" alt="CSS3" title="CSS3"/></a>
  <a href="https://developer.mozilla.org/pt-BR/docs/Web/JavaScript"><img src="https://skillicons.dev/icons?i=js" height="48" alt="JavaScript" title="JavaScript"/></a>
  <a href="https://www.npmjs.com/"><img src="https://skillicons.dev/icons?i=npm" height="48" alt="npm" title="npm"/></a>
</p>

<p align="center">
  <b>Ferramentas:</b><br>
  <a href="https://git-scm.com/"><img src="https://skillicons.dev/icons?i=git" height="40" alt="Git" title="Git"/></a>
  <a href="https://github.com/"><img src="https://skillicons.dev/icons?i=github" height="40" alt="GitHub" title="GitHub"/></a>
  <a href="https://code.visualstudio.com/"><img src="https://skillicons.dev/icons?i=vscode" height="40" alt="VS Code" title="VS Code"/></a>
</p>

- **Backend:** Node.js 22+ com Express 5
- **Banco de Dados:** PostgreSQL (ou SQLite, sem precisar instalar nada)
- **Frontend:** HTML, CSS e JavaScript puros
- **Testes:** node:test (18 testes, executados nos dois bancos)
- **Gerenciamento de Dependências:** npm

---

## 🚀 Como Executar

### 1. Configuração do Projeto
---
Clone o repositório:
```bash
git clone https://github.com/Daigder/Projeto-Hype-Cards.git
cd Projeto-Hype-Cards
```
Instale as dependências:
```bash
npm install
```

### 2. Configuração do Banco de Dados
---
Crie o banco no PostgreSQL (pelo pgAdmin ou pelo `psql`):
```sql
CREATE DATABASE hypecards;
```
Copie o arquivo `.env.example` para `.env` e coloque a senha do seu PostgreSQL:
```bash
DATABASE_URL=postgres://postgres:SUA_SENHA@localhost:5432/hypecards
```
As tabelas e os dados de exemplo são criados automaticamente na primeira execução.

> 💡 Sem o arquivo `.env`, o sistema usa **SQLite** (um arquivo em `data/hypecards.db`) e funciona sem instalar nenhum banco.

### 3. Execução
---
Inicie o servidor:
```bash
npm start
```
> No Windows, se o PowerShell bloquear o `npm`, use `npm.cmd start`.

Acesse a aplicação no navegador:
- Acesse o endereço http://localhost:3000.
- Entre com o usuário **`admin`** e a senha **`admin123`**. O sistema pede para trocar a senha no primeiro acesso.

Para rodar os testes automatizados:
```bash
npm test
```

## 🖥️ Telas da Aplicação

1. **Página de Login**
   - Acesso com usuário e senha, com bloqueio após 5 tentativas erradas e troca obrigatória da senha no primeiro acesso.

2. **Página de Resumo**
   - Painel com vendas e lucro do mês, valor e custo do estoque, itens mais vendidos e itens com estoque baixo.

3. **Páginas de Coleções, Cartas, Produtos e Acessórios**
   - Cadastro, edição e exclusão de itens com foto, busca, filtros, ordenação, paginação e visualização em tabela ou grade.

   ![Cartas na visualização em grade, com foto, preço e controle de estoque](docs/imagens/tela-cartas.png)

4. **Janela de Movimentação**
   - Registro de entrada ou saída com motivo, quantidade, valor e prévia do saldo antes de confirmar.

   ![Janela de movimentação registrando a venda de uma carta](docs/imagens/tela-venda.png)

5. **Página de Movimentações**
   - Histórico completo de entradas e saídas com filtros por item, tipo, operação, motivo e período, e exportação para CSV.

6. **Página de Usuários** *(somente administrador)*
   - Cadastro de vendedores e administradores, redefinição de senha e desativação de acesso.

## 📄 Documentação

- [Documentação do projeto (PDF)](docs/Hype%20Cards%20-%20Documentacao.pdf): requisitos, casos de uso, DER e diagramas de atividade, classes e sequência.
- [Guia técnico](docs/GUIA-TECNICO.md): referência da API REST, modelo de dados, migração para PostgreSQL e backup.

## 👨‍💻 Desenvolvedor
<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Daigder">
        <img src="https://avatars.githubusercontent.com/u/125320205?v=4" width="150px;" alt="Murillo Daigder"/>
        <br>
        <sub><b>Murillo Daigder</b></sub>
      </a>
    </td>
  </tr>
</table>

## 📌 Considerações Finais
Este projeto tem como objetivo não apenas controlar o estoque, mas também dar ao lojista uma visão clara das vendas e do lucro, com segurança e rastreabilidade em cada movimentação. Desenvolvido com uma arquitetura em camadas, que funciona tanto com PostgreSQL quanto com SQLite, o sistema pode ser facilmente ampliado com novas funcionalidades, como emissão de recibos, cadastro de clientes e fornecedores e relatórios por período.
