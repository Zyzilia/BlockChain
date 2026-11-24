const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { PENDING_HOLD_MINUTES } = require('../config');
const { auth, requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { calcOrderAmounts } = require('../services/pricing');
const { HttpError, toIso, isInt } = require('../utils/http');

const router = express.Router();
const orderLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyFn: (req) => `u${req.user.id}`, // dipasang setelah auth, jadi per pengguna
  message: 'Terlalu banyak pesanan, tunggu 1 menit',
});

const view = (o) => ({
  id: o.id,
  eventId: o.event_id,
  eventName: o.event_name,
  quantity: o.quantity,
  faceTotalIdr: o.face_total_idr,
  serviceFeeIdr: o.service_fee_idr,
  totalIdr: o.total_idr,
  status: o.status,
  midtransOrderId: o.midtrans_order_id,
  paymentType: o.payment_type,
  createdAt: toIso(o.created_at),
  expiresAt: new Date(Date.parse(toIso(o.created_at)) + PENDING_HOLD_MINUTES * 60_000).toISOString(),
});

const SELECT_ORDER = `SELECT o.*, e.name AS event_name FROM orders o JOIN events e ON e.id = o.event_id`;

// Pemeriksaan kuota dan kapasitas + penyimpanan order dilakukan dalam satu transaksi
const createOrder = db.transaction((userId, ev, quantity) => {
  const hold = `datetime('now', '-${PENDING_HOLD_MINUTES} minutes')`;

  const owned = db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE owner_user_id = ? AND event_id = ?').get(userId, ev.id).n;
  const myPending = db.prepare(
    `SELECT COALESCE(SUM(quantity), 0) AS n FROM orders
     WHERE user_id = ? AND event_id = ? AND status = 'pending' AND created_at > ${hold}`
  ).get(userId, ev.id).n;
  if (owned + myPending + quantity > ev.max_per_user) {
    const left = Math.max(0, ev.max_per_user - owned - myPending);
    throw new HttpError(409, `Batas ${ev.max_per_user} tiket per akun untuk event ini. Sisa jatah kamu: ${left}`);
  }

  const sold = db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE event_id = ?').get(ev.id).n;
  const reserved = db.prepare(
    `SELECT COALESCE(SUM(quantity), 0) AS n FROM orders
     WHERE event_id = ? AND status = 'pending' AND listing_id IS NULL AND created_at > ${hold}`
  ).get(ev.id).n;
  if (sold + reserved + quantity > ev.capacity) {
    throw new HttpError(409, `Tiket tidak cukup. Tersisa ${Math.max(0, ev.capacity - sold - reserved)}`);
  }

  const { faceTotal, serviceFee, total } = calcOrderAmounts(ev.face_value_idr, quantity);
  const midtransOrderId = `TA-${ev.id}-${userId}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const r = db.prepare(
    `INSERT INTO orders (user_id, event_id, quantity, face_total_idr, service_fee_idr, total_idr, midtrans_order_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, ev.id, quantity, faceTotal, serviceFee, total, midtransOrderId);
  return r.lastInsertRowid;
});

// Buat order (status pending). Pembayaran Midtrans ditambahkan di Tahap 4.
router.post('/', auth, requireRole('buyer'), orderLimiter, (req, res, next) => {
  try {
    const { eventId, quantity } = req.body || {};
    if (!isInt(eventId, 1, Number.MAX_SAFE_INTEGER)) throw new HttpError(400, 'eventId tidak valid');
    if (!isInt(quantity, 1, 10)) throw new HttpError(400, 'quantity harus bilangan bulat 1 - 10');

    const ev = db.prepare(`SELECT * FROM events WHERE id = ? AND status = 'published'`).get(eventId);
    if (!ev) throw new HttpError(404, 'Event tidak ditemukan atau belum terbit');
    if (new Date(ev.event_date) <= new Date()) throw new HttpError(409, 'Event sudah lewat');

    const orderId = createOrder(req.user.id, ev, quantity);
    const order = db.prepare(`${SELECT_ORDER} WHERE o.id = ?`).get(orderId);
    res.status(201).json({ order: view(order) });
  } catch (err) { next(err); }
});

router.get('/', auth, (req, res) => {
  const rows = db.prepare(`${SELECT_ORDER} WHERE o.user_id = ? ORDER BY o.id DESC`).all(req.user.id);
  res.json({ orders: rows.map(view) });
});

router.get('/:id', auth, (req, res, next) => {
  try {
    const o = db.prepare(`${SELECT_ORDER} WHERE o.id = ? AND o.user_id = ?`).get(req.params.id, req.user.id);
    if (!o) throw new HttpError(404, 'Order tidak ditemukan');
    res.json({ order: view(o) });
  } catch (err) { next(err); }
});

module.exports = router;
