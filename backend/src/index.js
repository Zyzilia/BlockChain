require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get();
  res.json({ status: 'ok', service: 'tiketaman-backend', tables: row.n, time: new Date().toISOString() });
});

// Route per tahap akan ditambahkan di sini:
// Tahap 3: /api/auth, /api/events, /api/orders
// Tahap 4: /api/payments/notification
// Tahap 6: /api/resale, /api/checkin

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`TiketAman backend jalan di http://localhost:${port}`));
