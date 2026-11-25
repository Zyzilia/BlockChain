// Pemenuhan pesanan: tiket yang sudah dibayar (status pending_mint) dicetak sebagai token di blockchain.
// Berjalan di latar belakang supaya webhook Midtrans dibalas cepat (mint butuh 10-30 detik).
const db = require('../db');
const {
  isConfigured, revertName, mintTicketOnChain, inspectMintTx, inspectTx, executeResaleOnChain, markUsedOnChain,
} = require('./blockchain');

const RETRY_BASE_MS = Number(process.env.MINT_RETRY_BASE_MS) || 15000;
const SWEEP_MS = Number(process.env.MINT_SWEEP_MS) || 20000;

const failures = new Map(); // kunci -> { n, next }  (jeda coba ulang bertambah, maksimal 5 menit)
let warnedNotConfigured = false;
let running = false;
let again = false;

const finalize = (ticketId, tokenId, txHash) =>
  db.prepare(`UPDATE tickets SET status = 'valid', token_id = ?, mint_tx_hash = ? WHERE id = ? AND status = 'pending_mint'`)
    .run(tokenId, txHash, ticketId);

async function processTicket(t) {
  const key = `t${t.id}`;
  if (backedOff(key)) return;

  try {
    if (!t.onchain_event_id) throw new Error('Event belum terkunci di blockchain');

    // Pemulihan: hash tersimpan berarti transaksi pernah dikirim
    if (t.mint_tx_hash) {
      const r = await inspectMintTx(t.mint_tx_hash);
      if (r.state === 'mined') {
        finalize(t.id, r.tokenId, t.mint_tx_hash);
        console.log(`[MINT] Tiket ${t.id}: dipulihkan dari transaksi sebelumnya, tokenId ${r.tokenId}`);
        return;
      }
      if (r.state === 'pending') return; // masih menunggu konfirmasi, jangan kirim ganda
      db.prepare('UPDATE tickets SET mint_tx_hash = NULL WHERE id = ?').run(t.id); // hilang atau gagal
    }

    const res = await mintTicketOnChain({
      onchainEventId: t.onchain_event_id,
      to: t.wallet,
      onTxSent: (hash) => db.prepare('UPDATE tickets SET mint_tx_hash = ? WHERE id = ?').run(hash, t.id),
    });
    finalize(t.id, res.tokenId, res.txHash);
    failures.delete(key);
    console.log(`[MINT] Tiket ${t.id} -> tokenId ${res.tokenId} (https://sepolia.etherscan.io/tx/${res.txHash})`);
  } catch (e) {
    if (e.message === 'BLOCKCHAIN_NOT_CONFIGURED') return;
    noteFailure(key, `Mint tiket ${t.id}`, e);
  }
}

// Mencatat kegagalan dan menjadwalkan coba ulang dengan jeda yang bertambah
function noteFailure(key, label, e) {
  const prev = failures.get(key);
  const n = (prev ? prev.n : 0) + 1;
  failures.set(key, { n, next: Date.now() + Math.min(300000, RETRY_BASE_MS * 2 ** (n - 1)) });
  let hint = '';
  if (e.code === 'INSUFFICIENT_FUNDS') hint = ' (saldo SepoliaETH akun platform habis, isi dari faucet)';
  const rn = revertName(e);
  console.error(`[CHAIN] ${label} gagal (percobaan ${n})${hint}: ${rn ? 'kontrak menolak: ' + rn : e.shortMessage || e.message}`);
}
const backedOff = (key) => { const f = failures.get(key); return f && f.next > Date.now(); };

// Check-in: gerbang sudah dijawab dari database (cepat), pencatatan di blockchain menyusul di sini
async function processCheckin(c) {
  const key = `c${c.id}`;
  if (backedOff(key)) return;
  try {
    const res = await markUsedOnChain(c.token_id);
    db.prepare('UPDATE checkins SET tx_hash = ? WHERE id = ?').run(res.txHash, c.id);
    failures.delete(key);
    console.log(`[CHECKIN] Tiket ${c.ticket_id} tercatat di blockchain (https://sepolia.etherscan.io/tx/${res.txHash})`);
  } catch (e) {
    if (e.message === 'BLOCKCHAIN_NOT_CONFIGURED') return;
    if (revertName(e) === 'AlreadyUsed') { // sudah tercatat (mis. pengiriman sebelumnya berhasil saat server mati)
      db.prepare('UPDATE checkins SET tx_hash = ? WHERE id = ?').run('sudah-tercatat', c.id);
      return;
    }
    noteFailure(key, `Check-in tiket ${c.ticket_id}`, e);
  }
}

const finalizeResale = db.transaction((row, txHash) => {
  db.prepare(`UPDATE resale_listings SET status = 'sold', buyer_user_id = ?, execute_tx_hash = ? WHERE id = ? AND status = 'active'`)
    .run(row.buyer_id, txHash, row.listing_id);
  db.prepare(`UPDATE tickets SET owner_user_id = ?, status = 'valid' WHERE id = ?`).run(row.buyer_id, row.ticket_id);
});

// Resale: pembeli sudah membayar, pindahkan token di blockchain lalu perbarui kepemilikan di database
async function processResale(row) {
  const key = `r${row.listing_id}`;
  if (backedOff(key)) return;
  try {
    if (row.execute_tx_hash) {
      const r = await inspectTx(row.execute_tx_hash, 'ResaleExecuted');
      if (r.state === 'mined') {
        finalizeResale(row, row.execute_tx_hash);
        console.log(`[RESALE] Listing ${row.listing_id}: dipulihkan dari transaksi sebelumnya`);
        return;
      }
      if (r.state === 'pending') return;
      db.prepare('UPDATE resale_listings SET execute_tx_hash = NULL WHERE id = ?').run(row.listing_id);
    }
    const res = await executeResaleOnChain({
      tokenId: row.token_id,
      buyer: row.buyer_wallet,
      onTxSent: (hash) => db.prepare('UPDATE resale_listings SET execute_tx_hash = ? WHERE id = ?').run(hash, row.listing_id),
    });
    finalizeResale(row, res.txHash);
    failures.delete(key);
    console.log(`[RESALE] Tiket ${row.ticket_id} berpindah ke pembeli (https://sepolia.etherscan.io/tx/${res.txHash})`);
  } catch (e) {
    if (e.message === 'BLOCKCHAIN_NOT_CONFIGURED') return;
    noteFailure(key, `Resale listing ${row.listing_id}`, e);
  }
}

async function processAll() {
  if (!isConfigured()) {
    if (!warnedNotConfigured) {
      console.warn('[MINT] Blockchain belum dikonfigurasi (RPC_URL, PLATFORM_PRIVATE_KEY, CONTRACT_ADDRESS). Tiket dibayar tetap menunggu.');
      warnedNotConfigured = true;
    }
    return;
  }
  // Urutan prioritas: check-in (antrean di pintu), resale, lalu pencetakan tiket baru
  const checkins = db
    .prepare(`SELECT c.id, c.ticket_id, t.token_id FROM checkins c JOIN tickets t ON t.id = c.ticket_id
              WHERE c.tx_hash IS NULL AND t.token_id IS NOT NULL ORDER BY c.id`)
    .all();
  for (const c of checkins) await processCheckin(c);

  const resales = db
    .prepare(
      `SELECT o.id AS order_id, o.user_id AS buyer_id, l.id AS listing_id, l.ticket_id, l.execute_tx_hash,
              t.token_id, bw.address AS buyer_wallet
       FROM orders o
       JOIN resale_listings l ON l.id = o.listing_id
       JOIN tickets t ON t.id = l.ticket_id
       JOIN wallets bw ON bw.user_id = o.user_id
       WHERE o.status = 'paid' AND l.status = 'active' AND t.status = 'listed' ORDER BY o.id`
    )
    .all();
  for (const r of resales) await processResale(r);

  const rows = db
    .prepare(
      `SELECT t.*, e.onchain_event_id, w.address AS wallet
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       JOIN events e ON e.id = t.event_id
       JOIN wallets w ON w.user_id = t.owner_user_id
       WHERE t.status = 'pending_mint' AND o.status = 'paid'
       ORDER BY t.id`
    )
    .all();
  for (const t of rows) await processTicket(t);
}

// Satu putaran pada satu waktu; permintaan yang masuk saat berjalan dijalankan lagi setelahnya
async function run() {
  if (running) { again = true; return; }
  running = true;
  try {
    do { again = false; await processAll(); } while (again);
  } finally {
    running = false;
  }
}

const kick = () => setImmediate(() => run().catch((e) => console.error('[MINT]', e)));

// Penyapu berkala: mencoba lagi tiket yang gagal dan memproses yang tertinggal saat server mati
function startWorker() {
  setInterval(() => run().catch((e) => console.error('[MINT]', e)), SWEEP_MS);
  kick();
}

module.exports = { kick, startWorker, run };
