require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { validateConfig } = require('./config');

validateConfig();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get();
  res.json({ status: 'ok', service: 'tiketaman-backend', tables: row.n, time: new Date().toISOString() });
});

// Konfigurasi publik untuk frontend (Client Key Midtrans memang dirancang publik)
app.get('/api/config', (req, res) => {
  res.json({
    midtransClientKey: process.env.MIDTRANS_CLIENT_KEY || null,
    contractAddress: process.env.CONTRACT_ADDRESS || null,
    network: 'sepolia',
    explorer: 'https://sepolia.etherscan.io',
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/resale', require('./routes/resale'));
app.use('/api/checkin', require('./routes/checkin'));

// Bila frontend sudah dibuild (npm run build di folder frontend), sajikan dari server yang sama.
// Satu alamat untuk demo, dan cukup satu tunnel (ngrok) untuk webhook sekaligus tampilan web.
const dist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/|health).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// Penanganan error terpusat
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body bukan JSON yang valid' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`TiketAman backend jalan di http://localhost:${port}`);
  require('./services/fulfillment').startWorker(); // cetak token untuk tiket yang sudah dibayar
});
// Koneksi menganggur dipertahankan lebih lama dari batas klien (fetch/undici 4 detik),
// supaya klien tidak memakai koneksi yang baru saja ditutup server ("fetch failed" acak).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
