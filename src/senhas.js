import crypto from 'node:crypto';

// Senhas são guardadas como "scrypt$<salt>$<hash>", nunca em texto puro
export function gerarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function conferirSenha(senha, guardado) {
  const [algoritmo, salt, hash] = String(guardado).split('$');
  if (algoritmo !== 'scrypt' || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const calculado = crypto.scryptSync(String(senha), salt, esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}
