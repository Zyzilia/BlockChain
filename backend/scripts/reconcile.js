// Rekonsiliasi: mencocokkan order berbayar, tiket di database, dan token di blockchain.
// Pakai: npm run reconcile           (database saja)
//        npm run reconcile:chain (ditambah memeriksa pemilik token langsung di Sepolia)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../src/db');

const withChain = process.argv.includes('--chain');
let problems = 0;
const line = (label, good, total, detail = '') => {
  const okk = good === total;
  if (!okk) problems++;
  console.log(`  ${okk ? '[COCOK] ' : '[SELISIH]'} ${label}: ${good}/${total}${detail}`);
};

(async () => {
  console.log('Rekonsiliasi order, pembayaran, dan token\n');

  const paid = db.prepare(`SELECT o.id, o.quantity, (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) AS n
                           FROM orders o WHERE o.status = 'paid' AND o.listing_id IS NULL`).all();
  line('order berbayar dengan jumlah tiket sesuai', paid.filter((o) => o.n === o.quantity).length, paid.length);

  const total = db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n;
  const pending = db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE status = 'pending_mint'`).get().n;
  const minted = db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE token_id IS NOT NULL AND mint_tx_hash IS NOT NULL`).get().n;
  line('tiket yang sudah tercetak sebagai token', total - pending, total, pending ? ` (${pending} menunggu dicetak)` : '');
  const bad = db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE status != 'pending_mint' AND (token_id IS NULL OR mint_tx_hash IS NULL)`).get().n;
  line('tiket tercetak dengan tokenId dan hash lengkap', total - pending - bad, total - pending);

  const unpaid = db.prepare(`SELECT COUNT(*) AS n FROM tickets t JOIN orders o ON o.id = t.order_id WHERE o.status NOT IN ('paid','refunded')`).get().n;
  line('tiket tanpa order berbayar (seharusnya 0)', 0, unpaid);

  if (withChain) {
    const { readTicketOnChain } = require('../src/services/blockchain');
    const rows = db.prepare(`SELECT t.id, t.token_id, w.address FROM tickets t JOIN wallets w ON w.user_id = t.owner_user_id WHERE t.token_id IS NOT NULL`).all();
    let good = 0;
    for (const t of rows) {
      try {
        const info = await readTicketOnChain(t.token_id);
        if (info.exists && info.owner.toLowerCase() === t.address.toLowerCase()) good++;
        else console.log(`   selisih: tiket ${t.id} (tokenId ${t.token_id}) pemilik on-chain ${info.owner || 'tidak ada'}`);
      } catch (e) { console.log(`   gagal membaca tokenId ${t.token_id}: ${e.shortMessage || e.message}`); }
    }
    line('pemilik token di blockchain = wallet pembeli', good, rows.length);
  } else {
    console.log('  (jalankan npm run reconcile:chain untuk memeriksa pemilik token langsung di Sepolia)');
  }

  console.log(problems ? `\n${problems} selisih ditemukan` : '\nSemua cocok (100%)');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
