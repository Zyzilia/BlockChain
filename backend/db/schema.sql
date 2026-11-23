-- Skema database TiketAman (SQLite). Uang disimpan sebagai integer rupiah.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  nim_hash      TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','organizer','admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id),
  address       TEXT NOT NULL UNIQUE,
  encrypted_key TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  organizer_id     INTEGER NOT NULL REFERENCES users(id),
  name             TEXT NOT NULL,
  venue            TEXT,
  event_date       TEXT NOT NULL,
  face_value_idr   INTEGER NOT NULL CHECK (face_value_idr > 0),
  capacity         INTEGER NOT NULL CHECK (capacity > 0),
  max_per_user     INTEGER NOT NULL DEFAULT 4,
  max_resale_bps   INTEGER NOT NULL DEFAULT 11000,
  onchain_event_id INTEGER,
  create_tx_hash   TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','ended','cancelled')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER,
  event_id      INTEGER NOT NULL REFERENCES events(id),
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  token_id      INTEGER UNIQUE,
  mint_tx_hash  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending_mint' CHECK (status IN ('pending_mint','valid','listed','used')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resale_listings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id       INTEGER NOT NULL REFERENCES tickets(id),
  seller_user_id  INTEGER NOT NULL REFERENCES users(id),
  buyer_user_id   INTEGER REFERENCES users(id),
  price_idr       INTEGER NOT NULL CHECK (price_idr > 0),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  execute_tx_hash TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  event_id          INTEGER NOT NULL REFERENCES events(id),
  listing_id        INTEGER REFERENCES resale_listings(id),
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  face_total_idr    INTEGER NOT NULL,
  service_fee_idr   INTEGER NOT NULL,
  total_idr         INTEGER NOT NULL,
  midtrans_order_id TEXT NOT NULL UNIQUE,
  snap_token        TEXT,
  payment_type      TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired','refunded')),
  paid_at           TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_notifications (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  midtrans_order_id  TEXT NOT NULL,
  transaction_status TEXT NOT NULL,
  signature_valid    INTEGER NOT NULL,
  raw_payload        TEXT NOT NULL,
  received_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (midtrans_order_id, transaction_status)
);

CREATE TABLE IF NOT EXISTS checkins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id     INTEGER NOT NULL UNIQUE REFERENCES tickets(id),
  scanner_id    INTEGER REFERENCES users(id),
  tx_hash       TEXT,
  checked_in_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_owner  ON tickets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event  ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_listings_state ON resale_listings(status);
