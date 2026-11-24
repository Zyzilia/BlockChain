// Klien Midtrans (SANDBOX saja). Memakai fetch langsung ke API resmi Midtrans:
//  - Snap     : membuat transaksi dan token pembayaran
//  - Status   : memeriksa status pembayaran (cadangan bila webhook tidak sampai)
const SNAP_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const API_URL = 'https://api.sandbox.midtrans.com/v2';

function authHeader() {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error('MIDTRANS_NOT_CONFIGURED');
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

async function postSnap(body) {
  const res = await fetch(SNAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function createSnapTransaction({ orderId, grossAmount, items, customer, expiryMinutes }) {
  const base = {
    transaction_details: { order_id: orderId, gross_amount: grossAmount },
    item_details: items,
    customer_details: customer,
  };
  // Beberapa versi API menerima 'minute', sebagian 'minutes'. Coba keduanya bila ditolak.
  let last;
  for (const unit of ['minute', 'minutes']) {
    last = await postSnap({ ...base, expiry: { unit, duration: expiryMinutes } });
    if (last.ok) return { token: last.data.token, redirectUrl: last.data.redirect_url };
    const msg = JSON.stringify(last.data.error_messages || '').toLowerCase();
    if (!msg.includes('expiry')) break;
  }
  const detail = Array.isArray(last.data.error_messages) ? last.data.error_messages.join('; ') : `HTTP ${last.status}`;
  throw new Error('MIDTRANS_ERROR: ' + detail);
}

// Mengembalikan body status dari Midtrans. status_code "404" berarti belum ada transaksi.
async function getTransactionStatus(orderId) {
  const res = await fetch(`${API_URL}/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: 'application/json', Authorization: authHeader() },
    signal: AbortSignal.timeout(15000),
  });
  return res.json().catch(() => ({}));
}

module.exports = { createSnapTransaction, getTransactionStatus };
