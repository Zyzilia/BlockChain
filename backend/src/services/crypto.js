const crypto = require('crypto');

function encKey() {
  const k = process.env.WALLET_ENC_KEY || '';
  if (Buffer.byteLength(k, 'utf8') !== 32) throw new Error('WALLET_ENC_KEY harus tepat 32 karakter');
  return Buffer.from(k, 'utf8');
}

// AES-256-GCM: hasil berformat iv.tag.ciphertext (base64)
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

function decrypt(payload) {
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// NIM tidak disimpan asli, hanya HMAC-nya (satu NIM = satu akun)
function hashNim(nim) {
  const pepper = process.env.NIM_PEPPER || process.env.JWT_SECRET;
  return crypto.createHmac('sha256', pepper).update(nim).digest('hex');
}

module.exports = { encrypt, decrypt, hashNim };
