const fs = require('fs');
const path = require('path');
const db = require('./db');

const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
db.exec(schema);
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();
console.log('Database siap. Tabel:', tables.map((t) => t.name).join(', '));
