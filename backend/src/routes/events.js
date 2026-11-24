const express = require('express');
const db = require('../db');
const { PENDING_HOLD_MINUTES } = require('../config');
const { auth, requireRole } = require('../middleware/auth');
const { createEventOnChain } = require('../services/blockchain');
const { serviceFeePerTicket } = require('../services/pricing');
const { HttpError, isInt } = require('../utils/http');

const router = express.Router();
const publishing = new Set(); // mencegah publish ganda pada event yang sama

// sold = tiket yang sudah tercetak; reserved = tiket di order pending yang belum kedaluwarsa
const SELECT_EVENT = `
  SELECT e.*, u.name AS organizer_name,
    (SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id) AS sold,
    (SELECT COALESCE(SUM(o.quantity), 0) FROM orders o
       WHERE o.event_id = e.id AND o.status = 'pending' AND o.listing_id IS NULL
         AND o.created_at > datetime('now', '-${PENDING_HOLD_MINUTES} minutes')) AS reserved
  FROM events e JOIN users u ON u.id = e.organizer_id`;

const view = (r) => ({
  id: r.id,
  name: r.name,
  venue: r.venue,
  eventDate: r.event_date,
  faceValueIdr: r.face_value_idr,
  serviceFeePerTicketIdr: serviceFeePerTicket(r.face_value_idr),
  capacity: r.capacity,
  sold: r.sold,
  available: Math.max(0, r.capacity - r.sold - r.reserved),
  maxPerUser: r.max_per_user,
  maxResaleBps: r.max_resale_bps,
  maxResalePriceIdr: Math.floor((r.face_value_idr * r.max_resale_bps) / 10000),
  status: r.status,
  organizerName: r.organizer_name,
  onchainEventId: r.onchain_event_id,
  createTxHash: r.create_tx_hash,
  createTxUrl: r.create_tx_hash ? `https://sepolia.etherscan.io/tx/${r.create_tx_hash}` : null,
});

// Publik: daftar event yang sudah terbit
router.get('/', (req, res) => {
  const rows = db.prepare(`${SELECT_EVENT} WHERE e.status = 'published' ORDER BY e.event_date`).all();
  res.json({ events: rows.map(view) });
});

// Penyelenggara: semua event miliknya (termasuk draft)
router.get('/mine', auth, requireRole('organizer'), (req, res) => {
  const rows = db.prepare(`${SELECT_EVENT} WHERE e.organizer_id = ? ORDER BY e.id DESC`).all(req.user.id);
  res.json({ events: rows.map(view) });
});

router.get('/:id', (req, res, next) => {
  try {
    const row = db.prepare(`${SELECT_EVENT} WHERE e.id = ? AND e.status = 'published'`).get(req.params.id);
    if (!row) throw new HttpError(404, 'Event tidak ditemukan');
    res.json({ event: view(row) });
  } catch (err) { next(err); }
});

// Penyelenggara membuat event (draft). Belum terkunci on-chain sampai dipublikasikan.
router.post('/', auth, requireRole('organizer'), (req, res, next) => {
  try {
    const b = req.body || {};
    const { name, venue = null, eventDate, faceValueIdr, capacity } = b;
    const maxPerUser = b.maxPerUser === undefined ? 4 : b.maxPerUser;
    const maxResaleBps = b.maxResaleBps === undefined ? 11000 : b.maxResaleBps;

    if (typeof name !== 'string' || name.trim().length < 3) throw new HttpError(400, 'Nama event minimal 3 karakter');
    const d = new Date(eventDate);
    if (typeof eventDate !== 'string' || Number.isNaN(d.getTime())) throw new HttpError(400, 'eventDate harus berupa tanggal ISO, contoh 2027-01-15T19:00:00');
    if (d <= new Date()) throw new HttpError(400, 'Tanggal event harus di masa depan');
    if (!isInt(faceValueIdr, 1000, 100_000_000)) throw new HttpError(400, 'faceValueIdr harus bilangan bulat rupiah (1.000 - 100.000.000)');
    if (!isInt(capacity, 1, 100_000)) throw new HttpError(400, 'capacity harus bilangan bulat 1 - 100.000');
    if (!isInt(maxPerUser, 1, 10)) throw new HttpError(400, 'maxPerUser harus 1 - 10');
    if (!isInt(maxResaleBps, 10000, 20000)) throw new HttpError(400, 'maxResaleBps harus 10000 - 20000 (11000 = 110%)');

    const r = db
      .prepare(`INSERT INTO events (organizer_id, name, venue, event_date, face_value_idr, capacity, max_per_user, max_resale_bps)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.user.id, name.trim(), venue, d.toISOString(), faceValueIdr, capacity, maxPerUser, maxResaleBps);
    const row = db.prepare(`${SELECT_EVENT} WHERE e.id = ?`).get(r.lastInsertRowid);
    res.status(201).json({ event: view(row) });
  } catch (err) { next(err); }
});

// Terbitkan event: konfigurasi dikunci di smart contract (tidak bisa diubah lagi)
router.post('/:id/publish', auth, requireRole('organizer'), async (req, res, next) => {
  const id = Number(req.params.id);
  let acquired = false;
  try {
    const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!ev || ev.organizer_id !== req.user.id) throw new HttpError(404, 'Event tidak ditemukan');
    if (ev.status !== 'draft') throw new HttpError(409, 'Event sudah diterbitkan');
    if (publishing.has(id)) throw new HttpError(409, 'Event sedang diproses');
    publishing.add(id);
    acquired = true;

    const wallet = db.prepare('SELECT address FROM wallets WHERE user_id = ?').get(req.user.id);
    let result;
    try {
      result = await createEventOnChain({
        faceValueIdr: ev.face_value_idr,
        capacity: ev.capacity,
        maxPerUser: ev.max_per_user,
        maxResaleBps: ev.max_resale_bps,
        organizerAddress: wallet.address,
      });
    } catch (e) {
      if (e.message === 'BLOCKCHAIN_NOT_CONFIGURED') {
        throw new HttpError(503, 'Blockchain belum dikonfigurasi (RPC_URL, PLATFORM_PRIVATE_KEY, CONTRACT_ADDRESS di .env)');
      }
      throw new HttpError(502, 'Gagal menulis ke blockchain: ' + (e.shortMessage || e.message));
    }

    db.prepare(`UPDATE events SET status = 'published', onchain_event_id = ?, create_tx_hash = ? WHERE id = ?`)
      .run(result.onchainEventId, result.txHash, id);
    const row = db.prepare(`${SELECT_EVENT} WHERE e.id = ?`).get(id);
    res.json({ event: view(row) });
  } catch (err) {
    next(err);
  } finally {
    if (acquired) publishing.delete(id);
  }
});

module.exports = router;
