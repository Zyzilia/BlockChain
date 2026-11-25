// Kunci di memori agar operasi on-chain yang lama (10-30 detik) pada objek yang sama tidak tumpang tindih
const held = new Set();

module.exports = {
  tryLock(key) { if (held.has(key)) return false; held.add(key); return true; },
  unlock(key) { held.delete(key); },
  isLocked: (key) => held.has(key),
};
