import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { criarApp } from '../src/app.js';

try {
  process.loadEnvFile();
} catch {}

const SENHA_ADMIN = 'senha-forte-123';
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function urlBancoDeTeste() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) return null;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/hypecards_teste';
  return url.toString();
}

async function prepararPostgres(url) {
  const nome = decodeURIComponent(new URL(url).pathname.slice(1));
  const urlServidor = new URL(url);
  urlServidor.pathname = '/postgres';
  const servidor = new pg.Client({ connectionString: urlServidor.toString() });
  await servidor.connect();
  const { rowCount } = await servidor.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
  if (!rowCount) await servidor.query(`CREATE DATABASE "${nome.replaceAll('"', '""')}"`);
  await servidor.end();

  const banco = new pg.Client({ connectionString: url });
  await banco.connect();
  await banco.query('DROP TABLE IF EXISTS movimentacoes, sessoes, usuarios, cartas, produtos, acessorios, colecoes CASCADE');
  await banco.end();
}

const URL_POSTGRES = urlBancoDeTeste();
const BANCOS = [
  {
    nome: 'SQLite',
    arquivoBackup: 'hypecards.db',
    opcoes: (pasta) => ({ dbArquivo: path.join(pasta, 'teste.db') }),
  },
  {
    nome: 'PostgreSQL',
    arquivoBackup: 'hypecards.sql',
    pular: URL_POSTGRES ? false : 'configure DATABASE_URL no .env para testar no PostgreSQL',
    preparar: () => prepararPostgres(URL_POSTGRES),
    opcoes: () => ({ databaseUrl: URL_POSTGRES }),
  },
];

for (const banco of BANCOS) {
  describe(banco.nome, { skip: banco.pular }, () => {
    let pasta, servidor, base, db;

    before(async () => {
      await banco.preparar?.();
      pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'hypecards-teste-'));
      let app;
      ({ app, db } = await criarApp({ ...banco.opcoes(pasta), pastaImagens: path.join(pasta, 'imagens') }));
      servidor = app.listen(0);
      await new Promise((ok) => servidor.once('listening', ok));
      base = `http://localhost:${servidor.address().port}`;
    });

    after(async () => {
      if (!servidor) return;
      servidor.closeAllConnections();
      await new Promise((ok) => servidor.close(ok));
      await db.fechar();
      fs.rmSync(pasta, { recursive: true, force: true });
    });

    function cliente() {
      let cookie = '';
      const req = async (caminho, { method = 'GET', body, tipo } = {}) => {
        const headers = {};
        if (cookie) headers.Cookie = cookie;
        if (body !== undefined) headers['Content-Type'] = tipo ?? 'application/json';
        const resposta = await fetch(base + caminho, {
          method,
          headers,
          body: body === undefined ? undefined : tipo ? body : JSON.stringify(body),
        });
        const setCookie = resposta.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';')[0];
        const conteudo = resposta.headers.get('content-type') ?? '';
        const dados = conteudo.includes('json') ? await resposta.json() : Buffer.from(await resposta.arrayBuffer());
        return { status: resposta.status, dados, headers: resposta.headers };
      };
      return req;
    }

    const admin = cliente();
    let vendedor;

    test('sem login, a API responde 401', async () => {
      const r = await cliente()('/api/cartas');
      assert.equal(r.status, 401);
    });

    test('login com senha errada é recusado', async () => {
      const r = await cliente()('/api/auth/login', { method: 'POST', body: { usuario: 'admin', senha: 'errada' } });
      assert.equal(r.status, 401);
    });

    test('admin entra com a senha inicial e é obrigado a trocá-la', async () => {
      const login = await admin('/api/auth/login', { method: 'POST', body: { usuario: 'admin', senha: 'admin123' } });
      assert.equal(login.status, 200);
      assert.equal(login.dados.trocar_senha, true);

      const bloqueado = await admin('/api/cartas');
      assert.equal(bloqueado.status, 403);

      const curta = await admin('/api/auth/senha', { method: 'POST', body: { senha_atual: 'admin123', nova_senha: '123' } });
      assert.equal(curta.status, 400);

      const troca = await admin('/api/auth/senha', { method: 'POST', body: { senha_atual: 'admin123', nova_senha: SENHA_ADMIN } });
      assert.equal(troca.status, 200);
      assert.equal(troca.dados.trocar_senha, false);

      const liberado = await admin('/api/cartas');
      assert.equal(liberado.status, 200);
    });

    test('CRUD de carta: criar, buscar, atualizar e excluir', async () => {
      const criada = await admin('/api/cartas', {
        method: 'POST',
        body: { nome: 'Gengar ex', colecao_id: 1, raridade: 'Double Rare (ex)', preco: 30, custo: 18, quantidade: 4, estoque_minimo: 2 },
      });
      assert.equal(criada.status, 201);
      assert.equal(criada.dados.nome, 'Gengar ex');
      assert.equal(criada.dados.custo, 18);
      const id = criada.dados.id;

      const atualizada = await admin(`/api/cartas/${id}`, {
        method: 'PUT',
        body: { ...criada.dados, preco: 35 },
      });
      assert.equal(atualizada.dados.preco, 35);

      assert.equal((await admin(`/api/cartas/${id}`, { method: 'DELETE' })).status, 204);
      assert.equal((await admin(`/api/cartas/${id}`)).status, 404);
    });

    test('validação de campos obrigatórios e valores inválidos', async () => {
      const semNome = await admin('/api/cartas', { method: 'POST', body: { colecao_id: 1 } });
      assert.equal(semNome.status, 400);
      assert.match(semNome.dados.erro, /Nome/);

      const precoNegativo = await admin('/api/acessorios', {
        method: 'POST',
        body: { nome: 'X', categoria: 'Sleeves', preco: -1 },
      });
      assert.equal(precoNegativo.status, 400);
    });

    test('coleção com cartas vinculadas não pode ser excluída', async () => {
      const r = await admin('/api/colecoes/2', { method: 'DELETE' });
      assert.equal(r.status, 409);
    });

    test('venda baixa o estoque e fica registrada no histórico com preço e usuário', async () => {
      const antes = (await admin('/api/cartas/2')).dados;
      const venda = await admin('/api/cartas/2/estoque', {
        method: 'PATCH',
        body: { operacao: 'saida', motivo: 'Venda', quantidade: 2, preco_unitario: 50, observacao: 'Cliente balcão' },
      });
      assert.equal(venda.status, 200);
      assert.equal(venda.dados.quantidade, antes.quantidade - 2);

      const historico = await admin('/api/movimentacoes?motivo=Venda');
      const registro = historico.dados.find((m) => m.recurso === 'cartas' && m.item_id === 2);
      assert.ok(registro);
      assert.equal(registro.quantidade, 2);
      assert.equal(registro.preco_unitario, 50);
      assert.equal(registro.custo_unitario, antes.custo);
      assert.equal(registro.quantidade_anterior, antes.quantidade);
      assert.equal(registro.usuario_nome, 'Administrador');
      assert.equal(registro.observacao, 'Cliente balcão');
    });

    test('venda aparece no resumo do mês com faturamento e lucro', async () => {
      const r = await admin('/api/resumo');
      assert.equal(r.status, 200);
      assert.ok(r.dados.vendasMes.unidades >= 2);
      assert.ok(r.dados.vendasMes.faturamento >= 100);
      assert.ok(r.dados.maisVendidos.some((v) => v.nome === 'Mew ex'));
      assert.ok('custo' in r.dados.cartas);
    });

    test('saída maior que o estoque é recusada e não gera histórico', async () => {
      const total = Number((await admin('/api/movimentacoes')).headers.get('x-total-count'));
      const r = await admin('/api/cartas/4/estoque', { method: 'PATCH', body: { operacao: 'saida', motivo: 'Venda', quantidade: 999 } });
      assert.equal(r.status, 400);
      assert.match(r.dados.erro, /insuficiente/);
      assert.equal(Number((await admin('/api/movimentacoes')).headers.get('x-total-count')), total);
    });

    test('motivo incompatível com a operação é recusado', async () => {
      const r = await admin('/api/cartas/1/estoque', { method: 'PATCH', body: { operacao: 'entrada', motivo: 'Venda', quantidade: 1 } });
      assert.equal(r.status, 400);
    });

    test('alterar a quantidade pela edição gera um ajuste no histórico', async () => {
      const item = (await admin('/api/acessorios/1')).dados;
      await admin('/api/acessorios/1', { method: 'PUT', body: { ...item, quantidade: item.quantidade + 5 } });
      const historico = (await admin('/api/acessorios/1/movimentacoes')).dados;
      assert.equal(historico[0].motivo, 'Ajuste de inventário');
      assert.equal(historico[0].operacao, 'entrada');
      assert.equal(historico[0].quantidade, 5);
    });

    test('ordenação e paginação com total no cabeçalho', async () => {
      const r = await admin('/api/produtos?ordenar=preco&direcao=desc&pagina=1&por_pagina=2');
      assert.equal(r.status, 200);
      assert.equal(r.dados.length, 2);
      assert.equal(Number(r.headers.get('x-total-count')), 3);
      assert.ok(r.dados[0].preco >= r.dados[1].preco);

      const pagina2 = await admin('/api/produtos?ordenar=preco&direcao=desc&pagina=2&por_pagina=2');
      assert.equal(pagina2.dados.length, 1);

      const invalida = await admin('/api/produtos?ordenar=senha_hash');
      assert.equal(invalida.status, 400);
    });

    test('exporta CSV com cabeçalho e separador ";"', async () => {
      const r = await admin('/api/acessorios/exportar.csv');
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-type'), /text\/csv/);
      const texto = r.dados.toString('utf8');
      assert.ok(texto.startsWith('﻿ID;Nome;Categoria'));
      assert.match(texto, /Sleeves Matte Preto/);

      const mov = await admin('/api/movimentacoes/exportar.csv?operacao=saida');
      assert.match(mov.dados.toString('utf8'), /Venda/);
    });

    test('envio e remoção de imagem', async () => {
      const envio = await admin('/api/produtos/1/imagem', { method: 'PUT', body: PNG_1PX, tipo: 'image/png' });
      assert.equal(envio.status, 200);
      assert.match(envio.dados.imagem, /\.png$/);

      const arquivo = await admin(`/imagens/${envio.dados.imagem}`);
      assert.equal(arquivo.status, 200);
      assert.equal((await cliente()(`/imagens/${envio.dados.imagem}`)).status, 401);

      const formatoInvalido = await admin('/api/produtos/1/imagem', { method: 'PUT', body: PNG_1PX, tipo: 'image/bmp' });
      assert.equal(formatoInvalido.status, 400);

      const remocao = await admin('/api/produtos/1/imagem', { method: 'DELETE' });
      assert.equal(remocao.dados.imagem, null);
    });

    test('admin cria vendedor; vendedor movimenta estoque mas não cadastra nem exclui', async () => {
      const criado = await admin('/api/usuarios', {
        method: 'POST',
        body: { nome: 'Ana Vendas', usuario: 'ana', senha: 'inicial1', perfil: 'vendedor' },
      });
      assert.equal(criado.status, 201);

      const duplicado = await admin('/api/usuarios', {
        method: 'POST',
        body: { nome: 'Outra', usuario: 'ANA', senha: 'inicial1', perfil: 'vendedor' },
      });
      assert.equal(duplicado.status, 409);

      vendedor = cliente();
      await vendedor('/api/auth/login', { method: 'POST', body: { usuario: 'ana', senha: 'inicial1' } });
      await vendedor('/api/auth/senha', { method: 'POST', body: { senha_atual: 'inicial1', nova_senha: 'nova-senha-1' } });

      assert.equal((await vendedor('/api/cartas')).status, 200);
      assert.equal((await vendedor('/api/cartas', { method: 'POST', body: { nome: 'X', colecao_id: 1 } })).status, 403);
      assert.equal((await vendedor('/api/cartas/1', { method: 'DELETE' })).status, 403);
      assert.equal((await vendedor('/api/usuarios')).status, 403);
      assert.equal((await vendedor('/api/backup')).status, 403);

      const entrada = await vendedor('/api/acessorios/2/estoque', { method: 'PATCH', body: { operacao: 'entrada', motivo: 'Compra', quantidade: 3 } });
      assert.equal(entrada.status, 200);
      const ultima = (await vendedor('/api/acessorios/2/movimentacoes')).dados[0];
      assert.equal(ultima.usuario_nome, 'Ana Vendas');
    });

    test('não é possível remover o último administrador nem excluir a si mesmo', async () => {
      const eu = (await admin('/api/auth/eu')).dados;
      assert.equal((await admin(`/api/usuarios/${eu.id}`, { method: 'DELETE' })).status, 400);
      const rebaixar = await admin(`/api/usuarios/${eu.id}`, { method: 'PUT', body: { nome: eu.nome, usuario: eu.usuario, perfil: 'vendedor' } });
      assert.equal(rebaixar.status, 400);
    });

    test('backup gera um arquivo .zip com o banco', async () => {
      const r = await admin('/api/backup');
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('content-type'), 'application/zip');
      assert.equal(r.dados.subarray(0, 2).toString(), 'PK');
      assert.ok(r.dados.includes(Buffer.from(banco.arquivoBackup)));
    });

    test('logout encerra a sessão', async () => {
      const sessao = cliente();
      await sessao('/api/auth/login', { method: 'POST', body: { usuario: 'admin', senha: SENHA_ADMIN } });
      assert.equal((await sessao('/api/resumo')).status, 200);
      await sessao('/api/auth/logout', { method: 'POST' });
      assert.equal((await sessao('/api/resumo')).status, 401);
    });
  });
}
