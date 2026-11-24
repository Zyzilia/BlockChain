// Uji otomatis Tahap 4 terhadap server yang berjalan (npm run dev di terminal lain).
// Membuat token Snap sungguhan di Midtrans SANDBOX, lalu mensimulasikan webhook Midtrans
// (dengan signature yang dihitung dari MIDTRANS_SERVER_KEY) untuk skenario sukses, gagal, kedaluwarsa.
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
// Kunci penandatangan webhook: Signature Secret Key (cadangan: Server Key untuk akun lama)
const SIGN_KEY = process.env.MIDTRANS_SIGNATURE_SECRET_KEY || SERVER_KEY;
let failures = 0;

async function call(method, p, body, token) {
  const res = await fetch(BASE + p, {
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

const sign = (orderId, code, gross) =>
  crypto.createHash('sha512').update(orderId + code + gross + SIGN_KEY).digest('hex');

// Meniru notifikasi HTTP dari Midtrans
function notify(order, status, { gross, code = '200', fraud = 'accept', badSignature = false, orderId } = {}) {
  const oid = orderId || order.midtransOrderId;
  const g = gross || `${order.totalIdr}.00`;
  return call('POST', '/api/payments/notification', {
    order_id: oid,
    status_code: code,
    gross_amount: g,
    transaction_status: status,
    payment_type: 'bank_transfer',
    fraud_status: fraud,
    signature_key: badSignature ? 'signature-palsu' : sign(oid, code, g),
  });
}

(async () => {
  if (!SERVER_KEY) {
    console.log('MIDTRANS_SERVER_KEY belum diisi di backend/.env. Lihat docs/08-setup-midtrans-ngrok.md');
    process.exit(1);
  }
  const stamp = Date.now();
  const nim = () => String(Math.floor(1e14 + Math.random() * 9e14));
  console.log(`Menguji ${BASE}\n`);

  console.log('1. Persiapan');
  let r = await call('POST', '/api/auth/register', { name: 'Alya Dummy', email: `alya${stamp}@student.ub.ac.id`, nim: nim(), password: 'password123' });
  check('daftar pembeli dummy', r.status === 201, r);
  const buyer = r.data && r.data.token;

  r = await call('GET', '/api/events');
  let ev = r.data.events.find((e) => e.onchainEventId && e.available >= 6);
  if (!ev) {
    console.log('   belum ada event terbit, membuat satu (10-30 detik, memakai sedikit gas)...');
    r = await call('POST', '/api/auth/register', { name: 'Panitia Dummy', email: `panitia${stamp}@student.ub.ac.id`, nim: nim(), password: 'password123', role: 'organizer' });
    const org = r.data.token;
    r = await call('POST', '/api/events', { name: 'Konser Dummy', eventDate: new Date(Date.now() + 30 * 864e5).toISOString(), faceValueIdr: 75000, capacity: 100 }, org);
    r = await call('POST', `/api/events/${r.data.event.id}/publish`, null, org);
    check('event diterbitkan', r.status === 200, r);
    ev = r.data.event;
  }
  check(`memakai event "${ev.name}" (id ${ev.id})`, !!ev);
  const mk = async (q) => (await call('POST', '/api/orders', { eventId: ev.id, quantity: q }, buyer)).data.order;

  console.log('\n2. Pembayaran sukses (2 tiket)');
  const o1 = await mk(2);
  check('order dibuat, total Rp160.000', o1 && o1.totalIdr === 160000, o1);
  r = await call('POST', `/api/orders/${o1.id}/pay`, null, buyer);
  if (r.status === 503) { console.log('  [LEWATI] Midtrans belum dikonfigurasi.'); process.exit(1); }
  check('token Snap dibuat di Midtrans sandbox', r.status === 200 && r.data.payment.token, r);
  if (r.data && r.data.payment) console.log('   tautan bayar:', r.data.payment.redirectUrl);
  r = await call('POST', `/api/orders/${o1.id}/sync`, null, buyer);
  check('cek status ke Midtrans sebelum bayar: masih pending', r.status === 200 && r.data.order.status === 'pending', r);
  r = await notify(o1, 'pending');
  check('webhook pending diterima', r.status === 200, r);
  r = await notify(o1, 'settlement', { badSignature: true });
  check('webhook dengan signature palsu ditolak (403)', r.status === 403, r);
  r = await call('GET', `/api/orders/${o1.id}`, null, buyer);
  check('order tidak berubah oleh webhook palsu', r.data.order.status === 'pending', r);
  r = await notify(o1, 'settlement');
  check('webhook settlement -> order paid', r.status === 200 && r.data.result === 'paid', r);
  r = await call('GET', '/api/tickets', null, buyer);
  check('2 tiket dibuat untuk pembeli', r.data.tickets.length === 2, r);
  r = await notify(o1, 'settlement');
  check('webhook yang sama dua kali tidak diproses ulang (idempotent)', r.data.result === 'duplicate', r);
  r = await call('GET', '/api/tickets', null, buyer);
  check('jumlah tiket tetap 2', r.data.tickets.length === 2, r);

  console.log('\n3. Pembayaran gagal dan kedaluwarsa');
  const o2 = await mk(1);
  r = await notify(o2, 'settlement', { gross: `${o2.totalIdr + 1000}.00` });
  check('nominal tidak cocok ditolak, order tetap pending', r.data.result === 'amount_mismatch', r);
  r = await notify(o2, 'deny');
  check('deny -> order failed', r.data.orderStatus === 'failed', r);
  const o3 = await mk(1);
  r = await notify(o3, 'expire');
  check('expire -> order expired', r.data.orderStatus === 'expired', r);
  r = await call('GET', '/api/tickets', null, buyer);
  check('gagal dan kedaluwarsa tidak menghasilkan tiket', r.data.tickets.length === 2, r);

  console.log('\n4. Kuota dilepas kembali');
  r = await call('POST', '/api/orders', { eventId: ev.id, quantity: 2 }, buyer);
  check('2 tiket milik + 2 baru = 4, diterima', r.status === 201, r);
  r = await call('POST', '/api/orders', { eventId: ev.id, quantity: 1 }, buyer);
  check('tiket ke-5 ditolak', r.status === 409, r);

  console.log(failures ? `\n${failures} pemeriksaan GAGAL` : '\nSemua pemeriksaan lulus');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('Tidak bisa menghubungi server. Pastikan npm run dev berjalan.\n', e.message); process.exit(1); });
