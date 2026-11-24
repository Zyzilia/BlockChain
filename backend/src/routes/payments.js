const express = require('express');
const { verifySignature, recordInvalid, applyNotification } = require('../services/payments');

const router = express.Router();

// Webhook Midtrans (publik, tanpa login). Keamanan lewat verifikasi signature.
// Balas 2xx secepatnya; 500 membuat Midtrans mencoba lagi satu kali.
router.post('/notification', (req, res, next) => {
  try {
    const p = req.body || {};
    if (!p.order_id || !p.status_code || !p.gross_amount || !p.transaction_status) {
      return res.status(400).json({ error: 'Payload notifikasi tidak lengkap' });
    }
    if (!verifySignature(p)) {
      recordInvalid(p);
      console.warn(`[WEBHOOK] Signature tidak valid untuk order ${p.order_id} (status ${p.transaction_status}).`);
      console.warn('          Cek: MIDTRANS_SIGNATURE_SECRET_KEY di .env harus sama dengan Signature Secret Key di dashboard Midtrans (Settings > Access Keys), bukan Server Key.');
      return res.status(403).json({ error: 'Signature tidak valid' });
    }
    const out = applyNotification(p);
    console.log(`[WEBHOOK] ${p.order_id} ${p.transaction_status} -> ${out.result}`);
    res.json({ ok: true, ...out });
  } catch (err) { next(err); }
});

module.exports = router;
