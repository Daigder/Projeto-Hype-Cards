# 🃏 Hype Cards — Controle de Estoque Pokémon TCG ⚡

[![Testes](https://github.com/Daigder/Projeto-Hype-Cards/actions/workflows/testes.yml/badge.svg)](https://github.com/Daigder/Projeto-Hype-Cards/actions/workflows/testes.yml)

Este projeto é um sistema web para controlar o estoque de uma loja de produtos **Pokémon TCG** (Trading Card Game). Ele permite cadastrar **coleções**, **cartas avulsas**, **produtos selados** (boosters, ETBs, displays) e **acessórios** (sleeves, deck boxes, pastas), registrar vendas com carrinho, desconto e recibo, controlar cada entrada e saída do estoque e acompanhar faturamento e lucro em relatórios com gráficos. É ideal para lojas e colecionadores que querem sair das planilhas e ter controle real do estoque.

---
## Imagem da Página Inicial do Projeto
![Página inicial do Hype Cards: painel de resumo com vendas e lucro do mês, valor do estoque e itens com estoque baixo](docs/imagens/tela-resumo.png)

## 🛠️ Funcionalidades

1. **Gerenciamento do Estoque**
   - Cadastro de coleções, cartas (raridade, condição, idioma), produtos selados e acessórios.
   - Foto de cada item, reduzida automaticamente no navegador antes do envio.
   - Preço de venda, preço de custo, quantidade e estoque mínimo por item.
   - Edição e exclusão de itens.

2. **Vendas**
   - Carrinho com vários itens (cartas, produtos e acessórios na mesma venda), busca rápida e controle de quantidade pelo estoque disponível.
   - Desconto em **%** ou em **R$**, repartido entre os itens para o lucro de cada um continuar correto.
   - Forma de pagamento: Pix, dinheiro, cartão de débito ou de crédito.
   - **Recibo** da venda para imprimir ou copiar e enviar ao cliente (WhatsApp, e-mail).
   - **Estorno** em um clique: os itens voltam para o estoque e a venda fica marcada como estornada, sem apagar o histórico.
   - A venda é tudo ou nada: se faltar saldo de um item, nada é gravado.

3. **Movimentações**
   - Registro de entradas (compra, devolução, ajuste) e saídas (venda, avaria, uso interno, ajuste).
   - Prévia do saldo antes de confirmar (ex.: *Estoque: 6 → 4 · Total: R$ 90,00*).
   - Histórico completo com data, motivo, valor e usuário responsável, ligado à venda de origem.
   - O estoque nunca fica negativo, mesmo com duas vendas ao mesmo tempo.

4. **Resumo e Relatórios**
   - Painel com vendas, lucro e margem do mês, valor do estoque e alerta de estoque baixo.
   - Relatórios por período (12 meses, ano, mês, 30 dias ou personalizado), por mês ou por dia.
   - Gráficos de faturamento e lucro, faturamento por categoria e por forma de pagamento.
   - Ticket médio, descontos concedidos, estornos e ranking dos itens que mais vendem.

5. **Busca e Exportação**
   - Busca por nome e filtros por coleção, estoque baixo, tipo de item, motivo e período.
   - Ordenação por coluna, paginação e visualização em tabela ou em grade com fotos.
   - Exportação das listas e do histórico para CSV (abre direto no Excel).

6. **Usuários e Segurança**
   - Login com dois perfis: **administrador** (acesso total) e **vendedor** (consulta e movimenta o estoque).
   - Senhas criptografadas, troca obrigatória no primeiro acesso e bloqueio após 5 tentativas erradas.
   - Backup em um clique: um arquivo ZIP com o banco de dados e todas as fotos.
   - Modo claro e escuro.

---

## 📂 Estrutura do Projeto

O sistema segue a arquitetura **cliente-servidor em camadas**:

- **Interface (`public/`):** telas em HTML, CSS e JavaScript, com o código dividido em módulos por tela (`public/js/`).
- **API (`src/`):** servidor Express com as regras de negócio: cadastros, vendas, movimentações, relatórios, login, CSV e backup.
- **Acesso a dados (`src/banco/`):** a mesma interface para **PostgreSQL** ou **SQLite**, escolhida pelo arquivo `.env`.

```
├── .github/workflows/  # Testes automáticos no GitHub a cada push
├── public/
│   ├── js/        # Módulos da interface: vendas, relatórios, gráficos, cadastros...
│   └── ...        # Telas de login e do sistema, estilos e tema claro/escuro
├── src/
│   ├── banco/     # Acesso ao PostgreSQL e ao SQLite
│   ├── app.js     # Monta a API e as rotas
│   ├── auth.js    # Login, sessões, perfis e usuários
│   ├── crud.js    # Cadastros, ordenação, paginação e imagens
│   ├── vendas.js  # Carrinho, desconto, estorno e recibo
│   ├── relatorios.js # Relatórios por período
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
- **Vendas:** itens, quantidades, preços, desconto, total, forma de pagamento, cliente, vendedor e situação (concluída ou estornada).
- **Movimentações:** item, operação, motivo, quantidade, valor, usuário, data e venda de origem.
- **Usuários:** nome, login, perfil e senha (guardada só como hash).

### Funcionalidades

- Cadastro, edição e remoção de coleções, cartas, produtos e acessórios.
- Vendas com carrinho, desconto, forma de pagamento, recibo e estorno.
- Registro de entradas e saídas com histórico auditável.
- Painel do mês e relatórios por período com gráficos.
- Busca, filtros, exportação CSV e backup.

Os requisitos detalhados, com os diagramas UML e o DER, estão na [documentação do projeto](docs/Hype%20Cards%20-%20Documentacao.pdf).

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
- **Testes:** node:test (25 testes, executados nos dois bancos) e GitHub Actions rodando tudo a cada push
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
Os testes também rodam sozinhos no GitHub a cada `push`, no SQLite e num PostgreSQL de teste. O resultado aparece no selo **Testes** no topo deste README e na aba **Actions** do repositório.

## 🖥️ Telas da Aplicação

1. **Página de Login**
   - Acesso com usuário e senha, com bloqueio após 5 tentativas erradas e troca obrigatória da senha no primeiro acesso.

2. **Página de Resumo**
   - Painel com vendas e lucro do mês, valor e custo do estoque, itens mais vendidos e itens com estoque baixo.

3. **Página Vender**
   - Busca de itens nas três categorias, carrinho com quantidades e preços, desconto, forma de pagamento e cliente.

   ![Tela de venda com o catálogo à esquerda e o carrinho com desconto à direita](docs/imagens/tela-carrinho.png)

4. **Recibo e Estorno**
   - Recibo da venda para imprimir ou copiar; o administrador pode estornar a venda, devolvendo os itens ao estoque.

   ![Recibo de venda com itens, subtotal, desconto e total](docs/imagens/tela-recibo.png)

5. **Página de Vendas**
   - Lista de vendas com filtros por número, cliente, forma de pagamento, situação e período.

6. **Página de Relatórios**
   - Indicadores, gráficos de faturamento e lucro, vendas por categoria e por forma de pagamento, e ranking dos itens.

   ![Relatórios com indicadores e gráfico de faturamento e lucro por dia](docs/imagens/tela-relatorios.png)

7. **Páginas de Coleções, Cartas, Produtos e Acessórios**
   - Cadastro, edição e exclusão de itens com foto, busca, filtros, ordenação, paginação e visualização em tabela ou grade.

   ![Cartas na visualização em grade, com foto, preço e controle de estoque](docs/imagens/tela-cartas.png)

8. **Janela de Movimentação**
   - Registro rápido de entrada ou saída com motivo, quantidade, valor e prévia do saldo antes de confirmar.

   ![Janela de movimentação registrando a venda de uma carta](docs/imagens/tela-venda.png)

9. **Página de Movimentações**
   - Histórico completo de entradas e saídas com filtros e exportação para CSV; cada venda tem um link para o seu recibo.

10. **Página de Usuários** *(somente administrador)*
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
Este projeto tem como objetivo não apenas controlar o estoque, mas também dar ao lojista uma visão clara das vendas e do lucro, com segurança e rastreabilidade em cada movimentação. Desenvolvido com uma arquitetura em camadas, que funciona tanto com PostgreSQL quanto com SQLite, o sistema pode ser facilmente ampliado com novas funcionalidades, como cadastro de clientes e fornecedores, emissão de nota fiscal e integração com uma loja virtual.
