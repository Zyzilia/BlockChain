const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { PENDING_HOLD_MINUTES } = require('../config');
const { auth, requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { serviceFeePerTicket, resaleBreakdown } = require('../services/pricing');
const { listTicketOnChain, cancelListingOnChain, revertName } = require('../services/blockchain');
const locks = require('../services/locks');
const { HttpError, toIso, isInt } = require('../utils/http');

const router = express.Router();
const buyLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyFn: (req) => `rb${req.user.id}`,
  message: 'Terlalu banyak percobaan beli, tunggu 1 menit',
});

const SELECT_LISTING = `
  SELECT l.*, e.id AS event_id, e.name AS event_name, e.event_date, e.face_value_idr, e.max_resale_bps,
         e.max_per_user, t.token_id
  FROM resale_listings l
  JOIN tickets t ON t.id = l.ticket_id
  JOIN events e ON e.id = t.event_id`;

const view = (l) => {
  const fee = serviceFeePerTicket(l.face_value_idr);
  const b = resaleBreakdown(l.price_idr, l.face_value_idr);
  return {
    id: l.id,
    ticketId: l.ticket_id,
    tokenId: l.token_id,
    eventId: l.event_id,
    eventName: l.event_name,
    eventDate: l.event_date,
    priceIdr: l.price_idr,
    faceValueIdr: l.face_value_idr,
    maxResalePriceIdr: Math.floor((l.face_value_idr * l.max_resale_bps) / 10000),
    serviceFeeIdr: fee,
    buyerTotalIdr: l.price_idr + fee,
    platformCommissionIdr: b.commission,
    organizerShareIdr: b.organizerShare,
    sellerNetIdr: b.sellerNet,
    status: l.status,
    executeTxUrl: l.execute_tx_hash ? `https://sepolia.etherscan.io/tx/${l.execute_tx_hash}` : null,
    createdAt: toIso(l.created_at),
  };
};

// Pesan yang ramah untuk penolakan dari smart contract
function mapChainError(e, fallback) {
  const name = revertName(e);
  if (e.message === 'BLOCKCHAIN_NOT_CONFIGURED') return new HttpError(503, 'Blockchain belum dikonfigurasi');
  if (name === 'PriceAboveCap') return new HttpError(400, 'Harga melebihi batas resale yang dikunci di smart contract');
  if (name === 'AlreadyListed') return new HttpError(409, 'Tiket sudah dijual');
  if (name === 'AlreadyUsed') return new HttpError(409, 'Tiket sudah dipakai');
  return new HttpError(502, `${fallback}: ${name || e.shortMessage || e.message}`);
}

// Publik: tiket yang sedang dijual ulang (event yang belum lewat)
router.get('/', (req, res) => {
  const rows = db
    .prepare(`${SELECT_LISTING} WHERE l.status = 'active' AND e.event_date > ? ORDER BY l.price_idr, l.id`)
    .all(new Date().toISOString());
  res.json({ listings: rows.map(view) });
});

// Penjualan milik sendiri (semua status)
router.get('/mine', auth, (req, res) => {
  const rows = db.prepare(`${SELECT_LISTING} WHERE l.seller_user_id = ? ORDER BY l.id DESC`).all(req.user.id);
  res.json({ listings: rows.map(view) });
});

// Pemilik tiket memasang tiketnya untuk dijual ulang. Harga dibatasi (default 110% dari nominal)
// oleh backend DAN oleh smart contract.
router.post('/', auth, async (req, res, next) => {
  let lockKey = null;
  try {
    const { ticketId, priceIdr } = req.body || {};
    if (!isInt(ticketId, 1, Number.MAX_SAFE_INTEGER)) throw new HttpError(400, 'ticketId tidak valid');
    if (!isInt(priceIdr, 1000, 100_000_000)) throw new HttpError(400, 'priceIdr harus bilangan bulat rupiah (minimal 1.000)');

    const t = db
      .prepare(`SELECT t.*, e.face_value_idr, e.max_resale_bps, e.event_date FROM tickets t
                JOIN events e ON e.id = t.event_id WHERE t.id = ? AND t.owner_user_id = ?`)
      .get(ticketId, req.user.id);
    if (!t) throw new HttpError(404, 'Tiket tidak ditemukan');
    if (t.status === 'pending_mint') throw new HttpError(409, 'Token tiket belum dicetak');
    if (t.status === 'listed') throw new HttpError(409, 'Tiket sudah dijual');
    if (t.status === 'used') throw new HttpError(409, 'Tiket sudah dipakai');
    if (new Date(t.event_date) <= new Date()) throw new HttpError(409, 'Event sudah lewat');

    const cap = Math.floor((t.face_value_idr * t.max_resale_bps) / 10000);
    if (priceIdr > cap) throw new HttpError(400, `Harga melebihi batas resale. Maksimal Rp${cap.toLocaleString('id-ID')} (${t.max_resale_bps / 100}% dari harga nominal)`);

    lockKey = `ticket:${t.id}`;
    if (!locks.tryLock(lockKey)) { lockKey = null; throw new HttpError(409, 'Tiket sedang diproses'); }

    try {
      await listTicketOnChain({ tokenId: t.token_id, priceIdr });
    } catch (e) {
      throw mapChainError(e, 'Gagal memasang penjualan di blockchain');
    }

    const listingId = db.transaction(() => {
      const r = db.prepare('INSERT INTO resale_listings (ticket_id, seller_user_id, price_idr) VALUES (?, ?, ?)')
        .run(t.id, req.user.id, priceIdr);
      db.prepare(`UPDATE tickets SET status = 'listed' WHERE id = ?`).run(t.id);
      return r.lastInsertRowid;
    })();
    const row = db.prepare(`${SELECT_LISTING} WHERE l.id = ?`).get(listingId);
    res.status(201).json({ listing: view(row) });
  } catch (err) { next(err); }
  finally { if (lockKey) locks.unlock(lockKey); }
});

// Penjual membatalkan penjualan (tidak bisa bila sudah ada pembeli yang membayar atau sedang membayar)
router.delete('/:id', auth, async (req, res, next) => {
  let lockKeys = [];
  try {
    const id = Number(req.params.id);
    const l = db.prepare(`${SELECT_LISTING} WHERE l.id = ? AND l.seller_user_id = ?`).get(id, req.user.id);
    if (!l) throw new HttpError(404, 'Penjualan tidak ditemukan');
    if (l.status !== 'active') throw new HttpError(409, `Penjualan sudah ${l.status}`);

    const keys = [`listing:${id}`, `ticket:${l.ticket_id}`];
    for (const k of keys) {
      if (!locks.tryLock(k)) { lockKeys.forEach(locks.unlock); lockKeys = []; throw new HttpError(409, 'Penjualan sedang diproses'); }
      lockKeys.push(k);
    }
    const busy = db
      .prepare(`SELECT 1 FROM orders WHERE listing_id = ? AND (status = 'paid'
                OR (status = 'pending' AND created_at > datetime('now', '-${PENDING_HOLD_MINUTES} minutes')))`)
      .get(id);
    if (busy) throw new HttpError(409, 'Sudah ada pembeli yang sedang membayar tiket ini, penjualan tidak bisa dibatalkan');

    try {
      await cancelListingOnChain(l.token_id);
    } catch (e) {
      if (revertName(e) !== 'NotListed') throw mapChainError(e, 'Gagal membatalkan di blockchain');
    }
    db.transaction(() => {
      db.prepare(`UPDATE resale_listings SET status = 'cancelled' WHERE id = ?`).run(id);
      db.prepare(`UPDATE tickets SET status = 'valid' WHERE id = ? AND status = 'listed'`).run(l.ticket_id);
    })();
    const row = db.prepare(`${SELECT_LISTING} WHERE l.id = ?`).get(id);
    res.json({ listing: view(row) });
  } catch (err) { next(err); }
  finally { lockKeys.forEach(locks.unlock); }
});

// Pembeli resale: membuat order (harga resale + biaya layanan). Bayar lewat POST /api/orders/:id/pay.
const createResaleOrder = db.transaction((userId, l) => {
  if (l.seller_user_id === userId) throw new HttpError(400, 'Kamu tidak bisa membeli tiket yang kamu jual sendiri');
  const hold = `datetime('now', '-${PENDING_HOLD_MINUTES} minutes')`;

  // Satu tiket hanya boleh punya satu pembeli yang sedang membayar
  const busy = db
    .prepare(`SELECT 1 FROM orders WHERE listing_id = ? AND (status = 'paid' OR (status = 'pending' AND created_at > ${hold}))`)
    .get(l.id);
  if (busy) throw new HttpError(409, 'Tiket ini sedang dalam proses pembayaran pembeli lain. Coba lagi dalam beberapa menit.');

  const owned = db.prepare('SELECT COUNT(*) AS n FROM tickets WHERE owner_user_id = ? AND event_id = ?').get(userId, l.event_id).n;
  const pending = db
    .prepare(`SELECT COALESCE(SUM(quantity), 0) AS n FROM orders WHERE user_id = ? AND event_id = ? AND status = 'pending' AND created_at > ${hold}`)
    .get(userId, l.event_id).n;
  if (owned + pending + 1 > l.max_per_user) {
    throw new HttpError(409, `Batas ${l.max_per_user} tiket per akun untuk event ini sudah tercapai`);
  }

  const fee = serviceFeePerTicket(l.face_value_idr);
  const midtransOrderId = `TA-R${l.id}-${userId}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const r = db
    .prepare(`INSERT INTO orders (user_id, event_id, listing_id, quantity, face_total_idr, service_fee_idr, total_idr, midtrans_order_id)
              VALUES (?, ?, ?, 1, ?, ?, ?, ?)`)
    .run(userId, l.event_id, l.id, l.price_idr, fee, l.price_idr + fee, midtransOrderId);
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(r.lastInsertRowid);
});

router.post('/:id/buy', auth, requireRole('buyer'), buyLimiter, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Penjualan tidak ditemukan');
    const l = db.prepare(`${SELECT_LISTING} WHERE l.id = ?`).get(id);
    if (!l) throw new HttpError(404, 'Penjualan tidak ditemukan');
    if (l.status !== 'active') throw new HttpError(409, `Penjualan sudah ${l.status}`);
    if (new Date(l.event_date) <= new Date()) throw new HttpError(409, 'Event sudah lewat');
    if (locks.isLocked(`listing:${id}`) || locks.isLocked(`ticket:${l.ticket_id}`)) {
      throw new HttpError(409, 'Penjualan sedang diproses, coba lagi sebentar');
    }

    const o = createResaleOrder(req.user.id, l);
    res.status(201).json({
      order: {
        id: o.id,
        listingId: o.listing_id,
        faceTotalIdr: o.face_total_idr,
        serviceFeeIdr: o.service_fee_idr,
        totalIdr: o.total_idr,
        status: o.status,
        midtransOrderId: o.midtrans_order_id,
        expiresAt: new Date(Date.parse(toIso(o.created_at)) + PENDING_HOLD_MINUTES * 60_000).toISOString(),
      },
      listing: view(l),
      next: `POST /api/orders/${o.id}/pay`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
