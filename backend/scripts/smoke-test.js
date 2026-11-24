// Uji alur Tahap 3 terhadap server yang sedang berjalan (npm run dev di terminal lain).
// Memakai data dummy dan membuat 1 event di Sepolia (gas sangat kecil).
const BASE = process.env.BASE_URL || 'http://localhost:3000';
let failures = 0;

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

function check(label, cond, detail) {
  console.log((cond ? '  [OK]    ' : '  [GAGAL] ') + label);
  if (!cond) { failures++; if (detail !== undefined) console.log('          ->', JSON.stringify(detail)); }
}

(async () => {
  const stamp = Date.now();
  const nim = () => String(Math.floor(1e14 + Math.random() * 9e14));
  console.log(`Menguji ${BASE}\n`);

  console.log('1. Akun');
  let r = await call('POST', '/api/auth/register', { name: 'Panitia Dummy', email: `panitia${stamp}@student.ub.ac.id`, nim: nim(), password: 'password123', role: 'organizer' });
  check('daftar penyelenggara', r.status === 201 && r.data.user.walletAddress, r);
  const org = r.data && r.data.token;

  const buyerNim = nim();
  r = await call('POST', '/api/auth/register', { name: 'Alya Dummy', email: `alya${stamp}@student.ub.ac.id`, nim: buyerNim, password: 'password123' });
  check('daftar pembeli + wallet custodial otomatis', r.status === 201 && r.data.user.walletAddress, r);
  const buyer = r.data && r.data.token;
  console.log('   wallet pembeli:', r.data && r.data.user.walletAddress);

  r = await call('POST', '/api/auth/register', { name: 'Akun Ganda', email: `ganda${stamp}@student.ub.ac.id`, nim: buyerNim, password: 'password123' });
  check('NIM yang sama ditolak (anti akun ganda)', r.status === 409, r);
  r = await call('POST', '/api/auth/register', { name: 'Bukan Kampus', email: `x${stamp}@gmail.com`, nim: nim(), password: 'password123' });
  check('email non-kampus ditolak', r.status === 400, r);
  r = await call('POST', '/api/auth/login', { email: `alya${stamp}@student.ub.ac.id`, password: 'password123' });
  check('login', r.status === 200 && r.data.token, r);
  r = await call('GET', '/api/orders');
  check('endpoint terlindungi tanpa token -> 401', r.status === 401, r);

  console.log('\n2. Event');
  const date = new Date(Date.now() + 30 * 864e5).toISOString();
  r = await call('POST', '/api/events', { name: 'Konser Dummy', eventDate: date, faceValueIdr: 75000, capacity: 100 }, buyer);
  check('pembeli tidak boleh membuat event -> 403', r.status === 403, r);
  r = await call('POST', '/api/events', { name: 'Konser Dummy', venue: 'Gedung Dummy', eventDate: date, faceValueIdr: 75000, capacity: 100 }, org);
  check('penyelenggara membuat event (draft)', r.status === 201 && r.data.event.status === 'draft', r);
  const eventId = r.data && r.data.event.id;

  console.log('   menerbitkan event ke blockchain (10-30 detik)...');
  r = await call('POST', `/api/events/${eventId}/publish`, null, org);
  if (r.status === 503) {
    console.log('  [LEWATI] Blockchain belum dikonfigurasi di .env. Isi RPC_URL, PLATFORM_PRIVATE_KEY, CONTRACT_ADDRESS lalu ulangi.');
    process.exit(1);
  }
  check('publish: konfigurasi terkunci on-chain', r.status === 200 && r.data.event.onchainEventId, r);
  if (r.data && r.data.event) console.log('   bukti:', r.data.event.createTxUrl);

  r = await call('GET', '/api/events');
  check('event tampil di daftar publik', r.data.events.some((e) => e.id === eventId), r);

  console.log('\n3. Order dan kuota');
  r = await call('POST', '/api/orders', { eventId, quantity: 2 }, buyer);
  check('order 2 tiket: total Rp160.000 (2 x 75.000 + 2 x 5.000)', r.status === 201 && r.data.order.totalIdr === 160000, r);
  r = await call('POST', '/api/orders', { eventId, quantity: 3 }, buyer);
  check('2 + 3 melebihi batas 4 -> ditolak', r.status === 409, r);
  r = await call('POST', '/api/orders', { eventId, quantity: 2 }, buyer);
  check('2 + 2 = 4 diterima', r.status === 201, r);
  r = await call('POST', '/api/orders', { eventId, quantity: 1 }, buyer);
  check('tiket ke-5 ditolak', r.status === 409, r);
  r = await call('GET', '/api/orders', null, buyer);
  check('riwayat order berisi 2 order', r.data.orders.length === 2, r);

  console.log(failures ? `\n${failures} pemeriksaan GAGAL` : '\nSemua pemeriksaan lulus');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Tidak bisa menghubungi server. Pastikan npm run dev berjalan.\n', e.message); process.exit(1); });
