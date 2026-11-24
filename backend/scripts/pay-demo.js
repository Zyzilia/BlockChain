// Demo bayar sungguhan di Midtrans SANDBOX: membuat order, mencetak tautan bayar,
// lalu menunggu sampai status order berubah (lewat webhook, atau cek status ke Midtrans).
// Pakai: npm run demo:pay            (webhook lewat tunnel, plus cek status ke Midtrans tiap 15 detik sebagai cadangan)
//        npm run demo:pay:sync  (tanpa tunnel: cek status ke Midtrans tiap 5 detik)
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const fastSync = process.argv.includes('--sync');

async function call(method, p, body, token) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const stamp = Date.now();
  const nim = String(Math.floor(1e14 + Math.random() * 9e14));
  let r = await call('POST', '/api/auth/register', { name: 'Pembeli Demo', email: `demo${stamp}@student.ub.ac.id`, nim, password: 'password123' });
  if (r.status !== 201) throw new Error('Gagal daftar: ' + JSON.stringify(r.data));
  const token = r.data.token;

  r = await call('GET', '/api/events');
  const ev = r.data.events.find((e) => e.available >= 2);
  if (!ev) throw new Error('Belum ada event terbit. Jalankan dulu: npm run smoke');

  r = await call('POST', '/api/orders', { eventId: ev.id, quantity: 1 }, token);
  const order = r.data.order;
  console.log(`Order #${order.id} untuk "${ev.name}": Rp${order.totalIdr.toLocaleString('id-ID')} (1 tiket + biaya layanan)`);

  r = await call('POST', `/api/orders/${order.id}/pay`, null, token);
  if (r.status !== 200) throw new Error('Gagal membuat pembayaran: ' + JSON.stringify(r.data));
  console.log('\nBuka tautan ini di browser, pilih metode bayar (sandbox):\n\n  ' + r.data.payment.redirectUrl + '\n');
  console.log('Lalu selesaikan pembayaran lewat simulator Midtrans (lihat docs/08-setup-midtrans-ngrok.md).');
  console.log(fastSync
    ? 'Mode --sync: status dicek ke Midtrans tiap 5 detik.\n'
    : 'Menunggu webhook dari Midtrans. Bila webhook tidak sampai, status dicek ke Midtrans tiap 15 detik.\n');

  let last = '';
  for (let i = 0; i < 180; i++) { // maksimal 15 menit
    await sleep(5000);
    // Cadangan: tanyakan ke Midtrans bila webhook belum mengubah status
    if (fastSync || i % 3 === 2) {
      const sy = await call('POST', `/api/orders/${order.id}/sync`, null, token);
      if (sy.status >= 400) console.log(`  (cek status ke Midtrans gagal: ${sy.data && sy.data.error})`);
    }
    const cur = (await call('GET', `/api/orders/${order.id}`, null, token)).data.order;
    if (cur.status !== last) { console.log(`  status order: ${cur.status}${cur.paymentType ? ' (' + cur.paymentType + ')' : ''}`); last = cur.status; }
    if (cur.status !== 'pending') {
      if (cur.status === 'paid') {
        console.log('\nLUNAS. Mencetak token tiket di Sepolia (10-30 detik)...');
        for (let k = 0; k < 40; k++) {
          const t = (await call('GET', '/api/tickets', null, token)).data.tickets[0];
          if (t && t.status === 'valid') {
            console.log(`\nTiket valid. tokenId ${t.tokenId}`);
            console.log('  Transaksi mint:', t.mintTxUrl);
            const v = (await call('GET', `/api/tickets/${t.id}/onchain`, null, token)).data;
            if (v && v.nftUrl) console.log('  Token di Etherscan:', v.nftUrl, `\n  Pemilik sesuai wallet pembeli: ${v.ownerMatches ? 'YA' : 'TIDAK'}`);
            return;
          }
          await sleep(5000);
        }
        console.log('Token belum tercetak setelah 3 menit. Cek log server (npm run dev), kemungkinan saldo SepoliaETH habis.');
      }
      return;
    }
  }
  console.log('Waktu habis. Order masih pending.');
})().catch((e) => { console.error(e.message); process.exit(1); });
