// Uji Tahap 6 terhadap server yang berjalan: resale berbatas harga dan check-in QR.
// Webhook Midtrans disimulasikan, tetapi transaksi blockchain di Sepolia sungguhan
// (sekitar 8 transaksi, memakai sedikit SepoliaETH). Lama: 3 sampai 5 menit.
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
async function waitFor(fn, seconds, every = 3000) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) { if (await fn()) return true; await sleep(every); }
  return false;
}
const stamp = Date.now();
const nim = () => String(Math.floor(1e14 + Math.random() * 9e14));
async function register(name, role = 'buyer') {
  const r = await call('POST', '/api/auth/register', { name, email: `${name.toLowerCase().replace(/\W/g, '')}${stamp}${Math.floor(Math.random() * 1e4)}@student.ub.ac.id`, nim: nim(), password: 'password123', role });
  if (r.status !== 201) throw new Error(`Gagal daftar ${name}: ${JSON.stringify(r.data)}`);
  return { token: r.data.token, wallet: r.data.user.walletAddress };
}
const settle = (order) => {
  const gross = `${order.totalIdr}.00`;
  return call('POST', '/api/payments/notification', {
    order_id: order.midtransOrderId, status_code: '200', gross_amount: gross, transaction_status: 'settlement',
    payment_type: 'bank_transfer', fraud_status: 'accept',
    signature_key: crypto.createHash('sha512').update(order.midtransOrderId + '200' + gross + SIGN_KEY).digest('hex'),
  });
};
const myTickets = async (u) => (await call('GET', '/api/tickets', null, u.token)).data.tickets;

(async () => {
  if (!SIGN_KEY) { console.log('MIDTRANS_SIGNATURE_SECRET_KEY belum diisi di backend/.env'); process.exit(1); }
  console.log(`Menguji ${BASE} (akan memakan 3-5 menit karena transaksi Sepolia)\n`);

  console.log('1. Persiapan: penyelenggara, event, dan penjual dengan 2 tiket');
  const org = await register('Panitia Dummy', 'organizer');
  let r = await call('POST', '/api/events', { name: 'Konser Resale Dummy', eventDate: new Date(Date.now() + 30 * 864e5).toISOString(), faceValueIdr: 75000, capacity: 100 }, org.token);
  const evId = r.data.event.id;
  r = await call('POST', `/api/events/${evId}/publish`, null, org.token);
  check('event diterbitkan (terkunci on-chain)', r.status === 200, r);

  const seller = await register('Penjual Dummy');
  r = await call('POST', '/api/orders', { eventId: evId, quantity: 2 }, seller.token);
  await settle(r.data.order);
  console.log('   menunggu 2 tiket dicetak...');
  const minted = await waitFor(async () => { const t = await myTickets(seller); return t.length === 2 && t.every((x) => x.status === 'valid'); }, 180);
  check('penjual memiliki 2 tiket valid', minted);
  if (!minted) process.exit(1);
  const [tA, tB] = (await myTickets(seller)).map((t) => t.id).sort((a, b) => a - b);

  console.log('\n2. Resale berbatas harga');
  r = await call('POST', '/api/resale', { ticketId: tA, priceIdr: 90000 }, seller.token);
  check('harga Rp90.000 (120%) ditolak', r.status === 400, r);
  if (r.data) console.log('   pesan:', r.data.error);
  console.log('   memasang Rp82.500 (110%) di blockchain...');
  r = await call('POST', '/api/resale', { ticketId: tA, priceIdr: 82500 }, seller.token);
  check('harga Rp82.500 (tepat 110%) diterima', r.status === 201, r);
  const L = r.data && r.data.listing;
  if (L) check('rincian: pembeli Rp87.500, komisi Rp4.125, penyelenggara Rp3.750, penjual Rp74.625',
    L.buyerTotalIdr === 87500 && L.platformCommissionIdr === 4125 && L.organizerShareIdr === 3750 && L.sellerNetIdr === 74625, L);
  r = await call('GET', '/api/resale');
  check('muncul di daftar penjualan publik', r.data.listings.some((x) => x.id === L.id), r);

  console.log('\n3. Pembeli resale');
  const buyer2 = await register('Pembeli Satu');
  const buyer3 = await register('Pembeli Dua');
  r = await call('POST', `/api/resale/${L.id}/buy`, null, buyer2.token);
  check('pembeli 1 membuat order resale Rp87.500', r.status === 201 && r.data.order.totalIdr === 87500, r);
  const order = r.data.order;
  r = await call('POST', `/api/resale/${L.id}/buy`, null, buyer3.token);
  check('pembeli 2 pada tiket yang sama ditolak (sedang dibayar)', r.status === 409, r);
  r = await call('DELETE', `/api/resale/${L.id}`, null, seller.token);
  check('penjual tidak bisa membatalkan saat ada pembeli', r.status === 409, r);
  r = await call('POST', `/api/orders/${order.id}/pay`, null, buyer2.token);
  if (r.status === 200) check('token Snap resale dibuat di Midtrans sandbox', !!r.data.payment.token, r);
  else console.log('   [LEWATI] /pay:', r.status, JSON.stringify(r.data));

  r = await settle(order);
  check('pembayaran resale diterima (webhook disimulasikan)', r.status === 200 && r.data.result === 'paid', r);
  console.log('   menunggu token berpindah di blockchain...');
  const moved = await waitFor(async () => (await myTickets(buyer2)).some((t) => t.id === tA && t.status === 'valid'), 120);
  check('tiket berpindah ke pembeli 1', moved);
  check('penjual tidak lagi memiliki tiket itu', !(await myTickets(seller)).some((t) => t.id === tA));
  r = await call('GET', `/api/tickets/${tA}/onchain`, null, buyer2.token);
  check('blockchain mencatat pemilik baru = wallet pembeli 1', r.status === 200 && r.data.ownerMatches === true, r);
  r = await call('GET', '/api/resale/mine', null, seller.token);
  const sold = r.data.listings.find((x) => x.id === L.id);
  check('listing berstatus sold', sold && sold.status === 'sold', sold);
  if (sold && sold.executeTxUrl) console.log('   bukti resale:', sold.executeTxUrl);

  console.log('\n4. QR berputar dan check-in');
  r = await call('GET', `/api/tickets/${tA}/qr`, null, seller.token);
  check('penjual lama tidak bisa mengambil QR tiket yang sudah dijual', r.status === 404, r);
  r = await call('GET', `/api/tickets/${tA}/qr`, null, buyer2.token);
  check('pemilik baru mendapat QR (berganti tiap 60 detik)', r.status === 200 && r.data.payload && r.data.qrDataUrl, r);
  const qr = r.data && r.data.payload;
  console.log('   QR berlaku sampai:', r.data && r.data.expiresAt);
  r = await call('POST', '/api/checkin', { qr: qr.slice(0, -2) + 'xx' }, org.token);
  check('QR yang dimodifikasi ditolak', r.status === 400, r);
  r = await call('POST', '/api/checkin', { qr }, buyer2.token);
  check('pembeli tidak boleh memindai (hanya penyelenggara)', r.status === 403, r);
  const t0 = Date.now();
  r = await call('POST', '/api/checkin', { qr }, org.token);
  const ms = Date.now() - t0;
  check(`check-in berhasil, gerbang menjawab ${ms} ms (target < 10 detik)`, r.status === 200 && ms < 10000, r);
  r = await call('POST', '/api/checkin', { qr }, org.token);
  check('scan kedua tiket yang sama ditolak', r.status === 409, r);

  console.log('   menunggu pencatatan check-in di blockchain...');
  let rec = null;
  const recorded = await waitFor(async () => { rec = (await call('GET', `/api/checkin/${tA}`, null, org.token)).data; return rec && rec.recordedOnChain; }, 90);
  check('check-in tercatat di blockchain', recorded, rec);
  if (rec && rec.txUrl) console.log('   bukti:', rec.txUrl);
  r = await call('GET', `/api/tickets/${tA}/onchain`, null, buyer2.token);
  check('kontrak menandai tiket sudah dipakai (used = true)', r.data && r.data.used === true, r);

  console.log('\n5. Batal jual');
  console.log('   memasang lalu membatalkan penjualan tiket kedua...');
  r = await call('POST', '/api/resale', { ticketId: tB, priceIdr: 75000 }, seller.token);
  check('tiket kedua dipasang Rp75.000', r.status === 201, r);
  r = await call('DELETE', `/api/resale/${r.data.listing.id}`, null, seller.token);
  check('penjualan dibatalkan', r.status === 200 && r.data.listing.status === 'cancelled', r);
  check('tiket kembali valid', (await myTickets(seller)).find((t) => t.id === tB).status === 'valid');

  console.log(failures ? `\n${failures} pemeriksaan GAGAL` : '\nSemua pemeriksaan lulus');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
