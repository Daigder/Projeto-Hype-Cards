import crypto from 'node:crypto';
import { Router } from 'express';
import { ErroHttp, lerId } from './http.js';
import { gerarHashSenha, conferirSenha } from './senhas.js';

const COOKIE = 'hc_sessao';
const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;
const TAMANHO_MIN_SENHA = 6;
const PERFIS = ['admin', 'vendedor'];

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 60 * 1000;
const tentativas = new Map();

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function lerCookies(req) {
  const cookies = {};
  for (const parte of (req.headers.cookie || '').split(';')) {
    const [nome, ...valor] = parte.trim().split('=');
    if (nome) cookies[nome] = decodeURIComponent(valor.join('='));
  }
  return cookies;
}

function definirCookie(res, valor, maxAgeSegundos) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSegundos}`
  );
}

const usuarioPublico = ({ id, nome, usuario, perfil, ativo, trocar_senha, criado_em }) => ({
  id, nome, usuario, perfil, ativo: Boolean(ativo), trocar_senha: Boolean(trocar_senha), criado_em,
});

function validarSenhaNova(senha) {
  if (typeof senha !== 'string' || senha.length < TAMANHO_MIN_SENHA) {
    throw new ErroHttp(400, `A senha deve ter pelo menos ${TAMANHO_MIN_SENHA} caracteres.`);
  }
}

export function criarAutenticacao(db) {
  const buscarSessao = (token) =>
    db.um(
      `SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.expira_em > ? AND u.ativo = 1`,
      [hashToken(token), Date.now()]
    );

  async function carregarUsuario(req, res, next) {
    const token = lerCookies(req)[COOKIE];
    req.usuario = token ? (await buscarSessao(token)) ?? null : null;
    req.tokenSessao = req.usuario ? token : null;
    next();
  }

  function exigirLogin(req, res, next) {
    if (!req.usuario) return res.status(401).json({ erro: 'Faça login para continuar.' });
    if (req.usuario.trocar_senha) {
      return res.status(403).json({ erro: 'Troque sua senha antes de continuar.', trocar_senha: true });
    }
    next();
  }

  function exigirAdmin(req, res, next) {
    if (req.usuario?.perfil !== 'admin') {
      return res.status(403).json({ erro: 'Apenas administradores podem fazer isso.' });
    }
    next();
  }

  const rotasAuth = Router();

  rotasAuth.post('/login', async (req, res) => {
    const usuario = String(req.body?.usuario ?? '').trim();
    const senha = String(req.body?.senha ?? '');
    if (!usuario || !senha) throw new ErroHttp(400, 'Informe usuário e senha.');

    const chave = `${req.ip}|${usuario.toLowerCase()}`;
    const registro = tentativas.get(chave);
    if (registro?.bloqueadoAte > Date.now()) {
      const segundos = Math.ceil((registro.bloqueadoAte - Date.now()) / 1000);
      throw new ErroHttp(429, `Muitas tentativas. Aguarde ${segundos} segundos e tente de novo.`);
    }

    const conta = await db.um('SELECT * FROM usuarios WHERE lower(usuario) = lower(?)', [usuario]);
    if (!conta || !conta.ativo || !conferirSenha(senha, conta.senha_hash)) {
      const erros = (registro?.erros ?? 0) + 1;
      tentativas.set(chave, erros >= MAX_TENTATIVAS ? { erros: 0, bloqueadoAte: Date.now() + BLOQUEIO_MS } : { erros });
      throw new ErroHttp(401, 'Usuário ou senha incorretos.');
    }
    tentativas.delete(chave);

    const token = crypto.randomBytes(32).toString('hex');
    await db.executar('DELETE FROM sessoes WHERE expira_em <= ?', [Date.now()]);
    await db.executar('INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)', [
      hashToken(token), conta.id, Date.now() + DURACAO_SESSAO_MS,
    ]);
    definirCookie(res, token, DURACAO_SESSAO_MS / 1000);
    res.json(usuarioPublico(conta));
  });

  rotasAuth.post('/logout', async (req, res) => {
    if (req.tokenSessao) await db.executar('DELETE FROM sessoes WHERE token_hash = ?', [hashToken(req.tokenSessao)]);
    definirCookie(res, '', 0);
    res.status(204).end();
  });

  rotasAuth.get('/eu', (req, res) => {
    if (!req.usuario) throw new ErroHttp(401, 'Faça login para continuar.');
    res.json(usuarioPublico(req.usuario));
  });

  rotasAuth.post('/senha', async (req, res) => {
    if (!req.usuario) throw new ErroHttp(401, 'Faça login para continuar.');
    const { senha_atual, nova_senha } = req.body ?? {};
    if (!conferirSenha(String(senha_atual ?? ''), req.usuario.senha_hash)) {
      throw new ErroHttp(400, 'A senha atual está incorreta.');
    }
    validarSenhaNova(nova_senha);
    if (nova_senha === senha_atual) throw new ErroHttp(400, 'A nova senha deve ser diferente da atual.');
    await db.executar('UPDATE usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?', [gerarHashSenha(nova_senha), req.usuario.id]);
    await db.executar('DELETE FROM sessoes WHERE usuario_id = ? AND token_hash <> ?', [req.usuario.id, hashToken(req.tokenSessao)]);
    res.json(usuarioPublico(await db.um('SELECT * FROM usuarios WHERE id = ?', [req.usuario.id])));
  });

  const rotasUsuarios = Router();
  rotasUsuarios.use(exigirAdmin);

  const buscarUsuario = async (id) => {
    const conta = await db.um('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!conta) throw new ErroHttp(404, 'Usuário não encontrado.');
    return conta;
  };

  const lerDadosUsuario = (corpo, { senhaObrigatoria }) => {
    const nome = String(corpo?.nome ?? '').trim();
    const usuario = String(corpo?.usuario ?? '').trim();
    const perfil = String(corpo?.perfil ?? '').trim();
    const ativo = corpo?.ativo === undefined ? 1 : Number(corpo.ativo === true || corpo.ativo === '1' || corpo.ativo === 1);
    const senha = corpo?.senha ? String(corpo.senha) : '';
    if (!nome) throw new ErroHttp(400, 'O campo "Nome" é obrigatório.');
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(usuario)) {
      throw new ErroHttp(400, 'O usuário deve ter de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.');
    }
    if (!PERFIS.includes(perfil)) throw new ErroHttp(400, 'Perfil inválido. Use: admin ou vendedor.');
    if (senhaObrigatoria || senha) validarSenhaNova(senha);
    return { nome, usuario, perfil, ativo, senha };
  };

  const garantirOutroAdmin = async (id) => {
    const { total } = await db.um("SELECT COUNT(*) AS total FROM usuarios WHERE perfil = 'admin' AND ativo = 1 AND id <> ?", [id]);
    if (total === 0) throw new ErroHttp(400, 'É preciso manter pelo menos um administrador ativo.');
  };

  rotasUsuarios.get('/', async (req, res) => {
    const busca = req.query.busca ? `%${req.query.busca}%` : '%';
    const { like, semCaixa } = db.sql;
    const lista = await db.consultar(
      `SELECT * FROM usuarios WHERE nome ${like} ? OR usuario ${like} ? ORDER BY ${semCaixa('nome')}`,
      [busca, busca]
    );
    res.json(lista.map(usuarioPublico));
  });

  rotasUsuarios.post('/', async (req, res) => {
    const d = lerDadosUsuario(req.body, { senhaObrigatoria: true });
    const { id } = await db.um(
      'INSERT INTO usuarios (nome, usuario, senha_hash, perfil, ativo, trocar_senha) VALUES (?, ?, ?, ?, ?, 1) RETURNING id',
      [d.nome, d.usuario, gerarHashSenha(d.senha), d.perfil, d.ativo]
    );
    res.status(201).json(usuarioPublico(await buscarUsuario(id)));
  });

  rotasUsuarios.put('/:id', async (req, res) => {
    const id = lerId(req.params.id);
    const atual = await buscarUsuario(id);
    const d = lerDadosUsuario(req.body, { senhaObrigatoria: false });
    if (atual.perfil === 'admin' && (d.perfil !== 'admin' || !d.ativo)) await garantirOutroAdmin(id);

    await db.transacao(async (tx) => {
      await tx.executar('UPDATE usuarios SET nome = ?, usuario = ?, perfil = ?, ativo = ? WHERE id = ?', [d.nome, d.usuario, d.perfil, d.ativo, id]);
      if (d.senha) {
        await tx.executar('UPDATE usuarios SET senha_hash = ?, trocar_senha = 1 WHERE id = ?', [gerarHashSenha(d.senha), id]);
      }
      if (d.senha || !d.ativo) await tx.executar('DELETE FROM sessoes WHERE usuario_id = ?', [id]);
    });
    res.json(usuarioPublico(await buscarUsuario(id)));
  });

  rotasUsuarios.delete('/:id', async (req, res) => {
    const id = lerId(req.params.id);
    const conta = await buscarUsuario(id);
    if (id === req.usuario.id) throw new ErroHttp(400, 'Você não pode excluir o próprio usuário.');
    if (conta.perfil === 'admin') await garantirOutroAdmin(id);
    await db.executar('DELETE FROM usuarios WHERE id = ?', [id]);
    res.status(204).end();
  });

  return { carregarUsuario, exigirLogin, exigirAdmin, rotasAuth, rotasUsuarios };
}
