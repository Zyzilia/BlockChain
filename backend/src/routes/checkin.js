const express = require('express');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { verifyPayload } = require('../services/qr');
const { kick } = require('../services/fulfillment');
const { HttpError } = require('../utils/http');

const router = express.Router();

// Penyelenggara memindai QR di pintu masuk.
// Keputusan masuk/tolak diambil dari database (kurang dari 1 detik); pencatatan "terpakai" di
// blockchain berjalan di latar belakang. Pemakaian kedua ditolak oleh database DAN smart contract.
router.post('/', auth, requireRole('organizer'), (req, res, next) => {
  try {
    const started = Date.now();
    const { qr } = req.body || {};
    if (typeof qr !== 'string' || !qr) throw new HttpError(400, 'qr wajib diisi');

    const v = verifyPayload(qr);
    if (v.error) throw new HttpError(400, v.error);

    const t = db
      .prepare(`SELECT t.*, e.organizer_id, e.name AS event_name, u.name AS holder_name
                FROM tickets t JOIN events e ON e.id = t.event_id JOIN users u ON u.id = t.owner_user_id
                WHERE t.id = ?`)
      .get(v.ticketId);
    if (!t) throw new HttpError(404, 'Tiket tidak ditemukan');
    if (t.organizer_id !== req.user.id) throw new HttpError(403, 'Tiket ini bukan untuk event milikmu');
    if (t.status === 'used') throw new HttpError(409, 'Tiket sudah dipakai');
    if (t.status === 'pending_mint' || t.token_id === null) throw new HttpError(409, 'Token tiket belum dicetak');

    const resaleInProgress = db
      .prepare(`SELECT 1 FROM resale_listings l JOIN orders o ON o.listing_id = l.id
                WHERE l.ticket_id = ? AND l.status = 'active' AND o.status = 'paid'`)
      .get(t.id);
    if (resaleInProgress) throw new HttpError(409, 'Tiket sedang dalam proses penjualan ulang, coba lagi sebentar');

    const checkinId = db.transaction(() => {
      const u = db.prepare(`UPDATE tickets SET status = 'used' WHERE id = ? AND status IN ('valid', 'listed')`).run(t.id);
      if (u.changes !== 1) throw new HttpError(409, 'Tiket sudah dipakai');
      db.prepare(`UPDATE resale_listings SET status = 'cancelled' WHERE ticket_id = ? AND status = 'active'`).run(t.id);
      return db.prepare('INSERT INTO checkins (ticket_id, scanner_id) VALUES (?, ?)').run(t.id, req.user.id).lastInsertRowid;
    })();

    kick(); // catat di blockchain di latar belakang
    res.json({
      ok: true,
      checkinId,
      ticket: { id: t.id, tokenId: t.token_id, eventName: t.event_name, holderName: t.holder_name },
      elapsedMs: Date.now() - started,
    });
  } catch (err) { next(err); }
});

// Status check-in sebuah tiket (untuk layar petugas atau pengecekan)
router.get('/:ticketId', auth, requireRole('organizer'), (req, res, next) => {
  try {
    const c = db
      .prepare(`SELECT c.*, e.organizer_id FROM checkins c JOIN tickets t ON t.id = c.ticket_id
                JOIN events e ON e.id = t.event_id WHERE c.ticket_id = ?`)
      .get(req.params.ticketId);
    if (!c || c.organizer_id !== req.user.id) throw new HttpError(404, 'Belum ada check-in untuk tiket ini');
    res.json({
      checkedInAt: c.checked_in_at.replace(' ', 'T') + 'Z',
      recordedOnChain: !!c.tx_hash,
      txUrl: c.tx_hash && c.tx_hash.startsWith('0x') ? `https://sepolia.etherscan.io/tx/${c.tx_hash}` : null,
    });
  } catch (err) { next(err); }
});

module.exports = router;
