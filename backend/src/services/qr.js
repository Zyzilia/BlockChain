// QR tiket berputar: isi QR berubah tiap 60 detik sehingga tangkapan layar yang lama tidak bisa dipakai.
// Format: TA1.<ticketId>.<jendelaWaktu>.<tanda tangan HMAC>
const crypto = require('crypto');

const WINDOW_S = 60;

const secret = () => crypto.createHmac('sha256', process.env.QR_SECRET || process.env.JWT_SECRET).update('tiketaman-qr-v1').digest();
const windowOf = (ms) => Math.floor(ms / 1000 / WINDOW_S);
const sign = (ticketId, w) => crypto.createHmac('sha256', secret()).update(`${ticketId}.${w}`).digest('base64url').slice(0, 22);

function makePayload(ticketId, nowMs = Date.now()) {
  const w = windowOf(nowMs);
  const endMs = (w + 1) * WINDOW_S * 1000;
  return {
    payload: `TA1.${ticketId}.${w}.${sign(ticketId, w)}`,
    expiresAt: new Date(endMs).toISOString(),
    refreshInSeconds: Math.max(1, Math.ceil((endMs - nowMs) / 1000)),
  };
}

// Menerima jendela waktu saat ini dan satu sebelumnya (toleransi jam dan waktu pindai): berlaku 60-120 detik
function verifyPayload(text, nowMs = Date.now()) {
  const parts = String(text || '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'TA1') return { error: 'QR tidak dikenali' };
  const ticketId = Number(parts[1]);
  const w = Number(parts[2]);
  if (!Number.isInteger(ticketId) || !Number.isInteger(w)) return { error: 'QR tidak dikenali' };

  const got = Buffer.from(parts[3]);
  const want = Buffer.from(sign(ticketId, w));
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { error: 'QR tidak valid' };

  const cur = windowOf(nowMs);
  if (w !== cur && w !== cur - 1) return { error: 'QR sudah kedaluwarsa. Minta pemilik tiket membuka ulang QR-nya.' };
  return { ticketId };
}

async function toDataUrl(payload) {
  const QRCode = require('qrcode');
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
}

module.exports = { makePayload, verifyPayload, toDataUrl, WINDOW_S };
