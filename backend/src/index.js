require('dotenv').config();
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

app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/tickets', require('./routes/tickets'));
// Tahap 6: /api/resale, /api/checkin

app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// Penanganan error terpusat
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body bukan JSON yang valid' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TiketAman backend jalan di http://localhost:${port}`));
