// Konfigurasi dan pemeriksaan .env saat server start
const PENDING_HOLD_MINUTES = 30; // order pending menahan kuota selama 30 menit

function validateConfig() {
  const problems = [];
  const jwt = process.env.JWT_SECRET || '';
  if (jwt.length < 16 || jwt === 'ganti-dengan-string-acak-panjang') {
    problems.push('JWT_SECRET belum diisi dengan nilai acak (minimal 16 karakter)');
  }
  if (Buffer.byteLength(process.env.WALLET_ENC_KEY || '', 'utf8') !== 32) {
    problems.push('WALLET_ENC_KEY harus tepat 32 karakter');
  }
  if (problems.length) {
    console.error('\nKonfigurasi .env belum benar:');
    problems.forEach((p) => console.error(' - ' + p));
    console.error('\nJalankan "npm run gen:keys" untuk membuat nilai yang aman, lalu salin ke backend/.env\n');
    process.exit(1);
  }
}

module.exports = {
  PENDING_HOLD_MINUTES,
  validateConfig,
  emailSuffix: () => (process.env.ALLOWED_EMAIL_SUFFIX || '.ac.id').toLowerCase(),
};
