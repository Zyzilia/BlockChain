const crypto = require('crypto');
const db = require('../db');

// Rumus resmi Midtrans: SHA512(order_id + status_code + gross_amount + SignatureSecretKey)
// Sejak 28 Okt 2026 kuncinya adalah Signature Secret Key (terpisah dari Server Key).
// Akun lama yang belum memisahkan kunci memakai Server Key yang sama, jadi dipakai sebagai cadangan.
// MIDTRANS_SIGNATURE_SECRET_KEY_OLD boleh diisi sementara saat rotasi kunci (retry notifikasi lama).
function signatureKeys() {
  const secret = process.env.MIDTRANS_SIGNATURE_SECRET_KEY;
  if (secret) return [secret, process.env.MIDTRANS_SIGNATURE_SECRET_KEY_OLD].filter(Boolean);
  return [process.env.MIDTRANS_SERVER_KEY].filter(Boolean);
}

function verifySignature(p) {
  const got = Buffer.from(String(p.signature_key || ''));
  return signatureKeys().some((key) => {
    const want = Buffer.from(
      crypto.createHash('sha512').update(`${p.order_id}${p.status_code}${p.gross_amount}${key}`).digest('hex')
    );
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  });
}

// Notifikasi palsu dicatat untuk audit dengan kunci berbeda ("invalid:..."),
// supaya tidak bisa dipakai memblokir notifikasi asli (idempotency).
function recordInvalid(p) {
  db.prepare(
    `INSERT OR IGNORE INTO payment_notifications (midtrans_order_id, transaction_status, signature_valid, raw_payload)
     VALUES (?, ?, 0, ?)`
  ).run(String(p.order_id), `invalid:${p.transaction_status}`, JSON.stringify(p).slice(0, 4000));
}

const isSuccess = (p) =>
  String(p.status_code) === '200' &&
  (p.transaction_status === 'settlement' || p.transaction_status === 'capture') &&
  (p.fraud_status === undefined || p.fraud_status === 'accept');

// Mesin status order. Hanya order 'pending' yang boleh berubah (kecuali refund dari 'paid'),
// sehingga notifikasi yang datang terlambat atau berulang tidak merusak status.
const apply = db.transaction((p) => {
  const status = String(p.transaction_status || '');
  const order = db.prepare('SELECT * FROM orders WHERE midtrans_order_id = ?').get(p.order_id);

  // Nominal harus cocok dengan order kita (cegah manipulasi)
  if (order && Math.round(parseFloat(p.gross_amount)) !== order.total_idr) {
    return { result: 'amount_mismatch', orderStatus: order.status };
  }

  // Idempotency: kunci (order_id, transaction_status). Notifikasi yang sama diproses sekali.
  const ins = db
    .prepare(
      `INSERT OR IGNORE INTO payment_notifications (midtrans_order_id, transaction_status, signature_valid, raw_payload)
       VALUES (?, ?, 1, ?)`
    )
    .run(p.order_id, status, JSON.stringify(p));
  if (ins.changes === 0) return { result: 'duplicate', orderStatus: order && order.status };
  if (!order) return { result: 'unknown_order' };

  if (isSuccess(p)) {
    if (order.status === 'pending') {
      db.prepare(`UPDATE orders SET status = 'paid', paid_at = datetime('now'), payment_type = COALESCE(?, payment_type) WHERE id = ?`)
        .run(p.payment_type || null, order.id);
      // Pembelian primer: buat baris tiket. Pencetakan token di blockchain dilakukan di Tahap 5.
      if (order.listing_id === null) {
        const addTicket = db.prepare(
          `INSERT INTO tickets (order_id, event_id, owner_user_id, status) VALUES (?, ?, ?, 'pending_mint')`
        );
        for (let i = 0; i < order.quantity; i++) addTicket.run(order.id, order.event_id, order.user_id);
      }
      return { result: 'paid', orderStatus: 'paid' };
    }
    if (order.status !== 'paid') {
      console.warn(`[PERINGATAN] Pembayaran masuk untuk order ${order.id} berstatus ${order.status}. Perlu refund manual.`);
    }
    return { result: 'ignored', orderStatus: order.status };
  }

  let next = null;
  if (status === 'pending') {
    if (order.status === 'pending' && p.payment_type) {
      db.prepare('UPDATE orders SET payment_type = ? WHERE id = ?').run(p.payment_type, order.id);
    }
  } else if (status === 'expire') {
    if (order.status === 'pending') next = 'expired';
  } else if (['deny', 'cancel', 'failure'].includes(status)) {
    if (order.status === 'pending') next = 'failed';
  } else if (['refund', 'partial_refund', 'chargeback'].includes(status)) {
    if (order.status === 'paid') next = 'refunded';
  }
  if (next) db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(next, order.id);
  return { result: next ? next : 'noted', orderStatus: next || order.status };
});

module.exports = { verifySignature, recordInvalid, applyNotification: apply };
