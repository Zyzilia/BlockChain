// Pemenuhan pesanan: tiket yang sudah dibayar (status pending_mint) dicetak sebagai token di blockchain.
// Berjalan di latar belakang supaya webhook Midtrans dibalas cepat (mint butuh 10-30 detik).
const db = require('../db');
const { isConfigured, mintTicketOnChain, inspectMintTx } = require('./blockchain');

const RETRY_BASE_MS = Number(process.env.MINT_RETRY_BASE_MS) || 15000;
const SWEEP_MS = Number(process.env.MINT_SWEEP_MS) || 20000;

const failures = new Map(); // ticketId -> { n, next }  (jeda coba ulang bertambah, maksimal 5 menit)
let warnedNotConfigured = false;
let running = false;
let again = false;

const finalize = (ticketId, tokenId, txHash) =>
  db.prepare(`UPDATE tickets SET status = 'valid', token_id = ?, mint_tx_hash = ? WHERE id = ? AND status = 'pending_mint'`)
    .run(tokenId, txHash, ticketId);

async function processTicket(t) {
  const f = failures.get(t.id);
  if (f && f.next > Date.now()) return;

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
    failures.delete(t.id);
    console.log(`[MINT] Tiket ${t.id} -> tokenId ${res.tokenId} (https://sepolia.etherscan.io/tx/${res.txHash})`);
  } catch (e) {
    if (e.message === 'BLOCKCHAIN_NOT_CONFIGURED') return;
    const n = (f ? f.n : 0) + 1;
    failures.set(t.id, { n, next: Date.now() + Math.min(300000, RETRY_BASE_MS * 2 ** (n - 1)) });
    let hint = '';
    if (e.code === 'INSUFFICIENT_FUNDS') hint = ' (saldo SepoliaETH akun platform habis, isi dari faucet)';
    console.error(`[MINT] Tiket ${t.id} gagal (percobaan ${n})${hint}: ${e.shortMessage || e.message}`);
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
