const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');
const { readTicketOnChain } = require('../services/blockchain');
const { HttpError } = require('../utils/http');
const { makePayload, toDataUrl } = require('../services/qr');

const router = express.Router();

// Tiket milik pengguna. Setelah Tahap 5, tokenId dan mintTxHash terisi.
router.get('/', auth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, e.name AS event_name, e.event_date FROM tickets t
       JOIN events e ON e.id = t.event_id WHERE t.owner_user_id = ? ORDER BY t.id DESC`
    )
    .all(req.user.id);
  res.json({
    tickets: rows.map((t) => ({
      id: t.id,
      eventId: t.event_id,
      eventName: t.event_name,
      eventDate: t.event_date,
      orderId: t.order_id,
      status: t.status,
      tokenId: t.token_id,
      mintTxHash: t.mint_tx_hash,
      mintTxUrl: t.mint_tx_hash ? `https://sepolia.etherscan.io/tx/${t.mint_tx_hash}` : null,
    })),
  });
});

// QR berputar: berubah tiap 60 detik. Aplikasi pemilik memanggil ulang endpoint ini sesuai refreshInSeconds.
router.get('/:id/qr', auth, async (req, res, next) => {
  try {
    const t = db.prepare('SELECT * FROM tickets WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.user.id);
    if (!t) throw new HttpError(404, 'Tiket tidak ditemukan');
    if (t.status === 'pending_mint') throw new HttpError(409, 'Token tiket belum dicetak');
    if (t.status === 'used') throw new HttpError(409, 'Tiket sudah dipakai');
    const q = makePayload(t.id);
    res.json({ ticketId: t.id, payload: q.payload, qrDataUrl: await toDataUrl(q.payload), expiresAt: q.expiresAt, refreshInSeconds: q.refreshInSeconds });
  } catch (err) { next(err); }
});

// Bukti keaslian: baca kepemilikan token langsung dari blockchain dan bandingkan dengan wallet pembeli
router.get('/:id/onchain', auth, async (req, res, next) => {
  try {
    const t = db.prepare('SELECT * FROM tickets WHERE id = ? AND owner_user_id = ?').get(req.params.id, req.user.id);
    if (!t) throw new HttpError(404, 'Tiket tidak ditemukan');
    if (t.token_id === null) throw new HttpError(409, 'Token belum dicetak. Tunggu beberapa detik lalu coba lagi.');
    const wallet = db.prepare('SELECT address FROM wallets WHERE user_id = ?').get(req.user.id).address;

    let info;
    try {
      info = await readTicketOnChain(t.token_id);
    } catch (e) {
      if (e.message === 'BLOCKCHAIN_NOT_CONFIGURED') throw new HttpError(503, 'Blockchain belum dikonfigurasi');
      throw new HttpError(502, 'Gagal membaca blockchain: ' + (e.shortMessage || e.message));
    }
    const contractAddress = process.env.CONTRACT_ADDRESS;
    res.json({
      tokenId: t.token_id,
      exists: info.exists,
      onchainOwner: info.owner || null,
      expectedOwner: wallet,
      ownerMatches: !!info.owner && info.owner.toLowerCase() === wallet.toLowerCase(),
      used: info.used || false,
      nftUrl: `https://sepolia.etherscan.io/nft/${contractAddress}/${t.token_id}`,
    });
  } catch (err) { next(err); }
});

module.exports = router;
