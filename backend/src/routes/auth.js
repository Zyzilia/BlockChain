const express = require('express');
const bcrypt = require('bcryptjs');
const { ethers } = require('ethers');
const db = require('../db');
const { emailSuffix } = require('../config');
const { encrypt, hashNim } = require('../services/crypto');
const { auth, signToken } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const { HttpError, toIso } = require('../utils/http');

const router = express.Router();
const limiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyFn: (req) => req.ip,
  message: 'Terlalu banyak percobaan, tunggu 1 menit',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u, walletAddress) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  walletAddress,
  createdAt: toIso(u.created_at),
});

// Daftar: email kampus + NIM (disimpan sebagai hash) -> akun + wallet custodial otomatis
router.post('/register', limiter, async (req, res, next) => {
  try {
    const { name, email, nim, password, role = 'buyer' } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2) throw new HttpError(400, 'Nama minimal 2 karakter');
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) throw new HttpError(400, 'Format email tidak valid');
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm.endsWith(emailSuffix())) {
      throw new HttpError(400, `Gunakan email kampus (berakhiran ${emailSuffix()})`);
    }
    if (typeof nim !== 'string' || !/^\d{8,20}$/.test(nim)) throw new HttpError(400, 'NIM harus berupa 8-20 digit angka');
    if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Password minimal 8 karakter');
    if (!['buyer', 'organizer'].includes(role)) throw new HttpError(400, 'role harus buyer atau organizer');

    const nimHash = hashNim(nim);
    const exists = db.prepare('SELECT 1 FROM users WHERE email = ? OR nim_hash = ?').get(emailNorm, nimHash);
    if (exists) throw new HttpError(409, 'Email atau NIM sudah terdaftar');

    const passwordHash = await bcrypt.hash(password, 10);
    const wallet = ethers.Wallet.createRandom();
    const encryptedKey = encrypt(wallet.privateKey);

    const insert = db.transaction(() => {
      const r = db
        .prepare('INSERT INTO users (name, email, nim_hash, password_hash, role) VALUES (?, ?, ?, ?, ?)')
        .run(name.trim(), emailNorm, nimHash, passwordHash, role);
      db.prepare('INSERT INTO wallets (user_id, address, encrypted_key) VALUES (?, ?, ?)')
        .run(r.lastInsertRowid, wallet.address, encryptedKey);
      return r.lastInsertRowid;
    });
    const userId = insert();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json({ token: signToken(user), user: publicUser(user, wallet.address) });
  } catch (err) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') return next(new HttpError(409, 'Email atau NIM sudah terdaftar'));
    next(err);
  }
});

router.post('/login', limiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'Email dan password wajib diisi');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) throw new HttpError(401, 'Email atau password salah');
    const w = db.prepare('SELECT address FROM wallets WHERE user_id = ?').get(user.id);
    res.json({ token: signToken(user), user: publicUser(user, w && w.address) });
  } catch (err) { next(err); }
});

router.get('/me', auth, (req, res, next) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw new HttpError(401, 'Akun tidak ditemukan');
    const w = db.prepare('SELECT address FROM wallets WHERE user_id = ?').get(user.id);
    res.json({ user: publicUser(user, w && w.address) });
  } catch (err) { next(err); }
});

module.exports = router;
