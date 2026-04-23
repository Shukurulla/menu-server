const crypto = require('crypto');

function getKey() {
  const secret = process.env.AES_SECRET || '0123456789abcdef0123456789abcdef';
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(payload) {
  if (!payload || typeof payload !== 'string' || !payload.includes(':')) return null;
  const [ivHex, encHex] = payload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
