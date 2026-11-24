// Uji Tahap 5 terhadap server yang berjalan: pembayaran sukses -> token tiket tercetak di Sepolia.
// Webhook Midtrans disimulasikan (signature dihitung dari MIDTRANS_SIGNATURE_SECRET_KEY),
// tetapi pencetakan token benar-benar terjadi di blockchain (memakai sedikit SepoliaETH).
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SIGN_KEY = process.env.MIDTRANS_SIGNATURE_SECRET_KEY || process.env.MIDTRANS_SERVER_KEY;
let failures = 0;

async function call(method, p, body, token) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
function check(label, cond, detail) {
  console.log((cond ? '  [OK]    ' : '  [GAGAL] ') + label);
  if (!cond) { failures++; if (detail !== undefined) console.log('          ->', JSON.stringify(detail)); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!SIGN_KEY) { console.log('MIDTRANS_SIGNATURE_SECRET_KEY belum diisi di backend/.env'); process.exit(1); }
  const stamp = Date.now();
  const nim = () => String(Math.floor(1e14 + Math.random() * 9e14));
  console.log(`Menguji ${BASE}\n`);

  console.log('1. Persiapan');
  let r = await call('POST', '/api/auth/register', { name: 'Alya Dummy', email: `alya${stamp}@student.ub.ac.id`, nim: nim(), password: 'password123' });
  check('daftar pembeli dummy', r.status === 201, r);
  const buyer = r.data.token;
  const wallet = r.data.user.walletAddress;
  console.log('   wallet pembeli:', wallet);

  r = await call('GET', '/api/events');
  let ev = r.data.events.find((e) => e.onchainEventId && e.available >= 3);
  if (!ev) {
    console.log('   belum ada event terbit, membuat satu (10-30 detik)...');
    r = await call('POST', '/api/auth/register', { name: 'Panitia Dummy', email: `panitia${stamp}@student.ub.ac.id`, nim: nim(), password: 'password123', role: 'organizer' });
    const org = r.data.token;
    r = await call('POST', '/api/events', { name: 'Konser Dummy', eventDate: new Date(Date.now() + 30 * 864e5).toISOString(), faceValueIdr: 75000, capacity: 100 }, org);
    r = await call('POST', `/api/events/${r.data.event.id}/publish`, null, org);
    check('event diterbitkan', r.status === 200, r);
    ev = r.data.event;
  }
  check(`memakai event "${ev.name}" (id ${ev.id})`, !!ev);

  console.log('\n2. Bayar (disimulasikan) lalu token dicetak');
  r = await call('POST', '/api/orders', { eventId: ev.id, quantity: 2 }, buyer);
  const order = r.data.order;
  check('order 2 tiket dibuat', r.status === 201, r);

  const gross = `${order.totalIdr}.00`;
  const notify = () => call('POST', '/api/payments/notification', {
    order_id: order.midtransOrderId, status_code: '200', gross_amount: gross,
    transaction_status: 'settlement', payment_type: 'bank_transfer', fraud_status: 'accept',
    signature_key: crypto.createHash('sha512').update(order.midtransOrderId + '200' + gross + SIGN_KEY).digest('hex'),
  });
  const t0 = Date.now();
  r = await notify();
  check('webhook settlement diterima, order paid', r.status === 200 && r.data.result === 'paid', r);

  console.log('   menunggu token dicetak di Sepolia (biasanya 20-60 detik untuk 2 tiket)...');
  let tickets = [];
  for (let i = 0; i < 60; i++) { // maksimal 3 menit
    await sleep(3000);
    tickets = (await call('GET', '/api/tickets', null, buyer)).data.tickets;
    if (tickets.length === 2 && tickets.every((t) => t.status === 'valid')) break;
  }
  check('2 tiket berstatus valid', tickets.length === 2 && tickets.every((t) => t.status === 'valid'), tickets);
  console.log(`   waktu sampai valid: ${Math.round((Date.now() - t0) / 1000)} detik`);
  check('tokenId unik untuk tiap tiket', new Set(tickets.map((t) => t.tokenId)).size === 2 && tickets.every((t) => t.tokenId), tickets);
  tickets.forEach((t) => console.log(`   tiket ${t.id}: tokenId ${t.tokenId}  ${t.mintTxUrl}`));

  console.log('\n3. Verifikasi langsung ke blockchain');
  for (const t of tickets) {
    r = await call('GET', `/api/tickets/${t.id}/onchain`, null, buyer);
    check(`tokenId ${t.tokenId}: pemilik di blockchain = wallet pembeli, belum dipakai`,
      r.status === 200 && r.data.ownerMatches === true && r.data.used === false, r);
    if (r.data && r.data.nftUrl) console.log('   ', r.data.nftUrl);
  }

  console.log('\n4. Webhook ganda tidak mencetak ulang');
  r = await notify();
  check('webhook yang sama dikenali sebagai duplicate', r.data && r.data.result === 'duplicate', r);
  await sleep(5000);
  tickets = (await call('GET', '/api/tickets', null, buyer)).data.tickets;
  check('jumlah tiket tetap 2', tickets.length === 2, tickets);

  console.log(failures ? `\n${failures} pemeriksaan GAGAL` : '\nSemua pemeriksaan lulus');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Tidak bisa menghubungi server. Pastikan npm run dev berjalan.\n', e.message); process.exit(1); });
