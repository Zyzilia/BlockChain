const express = require('express');
const db = require('../db');
const { auth } = require('../middleware/auth');

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

module.exports = router;
