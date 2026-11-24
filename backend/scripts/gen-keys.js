// Membuat nilai acak untuk JWT_SECRET dan WALLET_ENC_KEY. Salin ke backend/.env
const crypto = require('crypto');
console.log('JWT_SECRET=' + crypto.randomBytes(48).toString('hex'));
console.log('WALLET_ENC_KEY=' + crypto.randomBytes(24).toString('base64')); // tepat 32 karakter
