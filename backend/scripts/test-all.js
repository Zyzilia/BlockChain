// Menjalankan semua uji berurutan (uji menyeluruh sebelum demo).
// Server harus menyala (npm run dev di terminal lain). Total sekitar 8-12 menit karena transaksi Sepolia.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const backend = path.resolve(__dirname, '..');
const contracts = path.resolve(__dirname, '../../contracts');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const steps = [
  { name: 'Tahap 2  Smart contract (20 test lokal)', cmd: 'npm test', cwd: contracts },
  { name: 'Tahap 3  Akun, event, order', cmd: 'npm run smoke', cwd: backend },
  { name: 'Tahap 4  Pembayaran dan webhook', cmd: 'npm run test:payment', cwd: backend },
  { name: 'Tahap 5  Token tercetak setelah bayar', cmd: 'npm run test:mint', cwd: backend },
  { name: 'Tahap 6  Resale dan check-in QR', cmd: 'npm run test:flow', cwd: backend },
  { name: 'Rekonsiliasi order, token, blockchain', cmd: 'npm run reconcile:chain', cwd: backend },
];

// Menunggu server menjawab (mis. saat node --watch sedang memulai ulang)
async function waitHealth(seconds = 20) {
  for (let i = 0; i < seconds; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) return true; } catch (_) { /* belum siap */ }
    await sleep(1000);
  }
  return false;
}

const run = (s, cmd) => spawnSync(cmd, { cwd: s.cwd, stdio: 'inherit', shell: true });

(async () => {
  if (!(await waitHealth(5))) {
    console.error(`Server di ${BASE} tidak bisa dihubungi. Jalankan dulu: npm run dev (folder backend).`);
    process.exit(1);
  }

  const results = [];
  for (const s of steps) {
    console.log(`\n==================== ${s.name} ====================`);
    const t0 = Date.now();
    let ok;

    if (s.cwd === contracts) {
      if (!fs.existsSync(path.join(contracts, 'package.json'))) {
        console.error(`Folder contracts di repo belum lengkap (tidak ada ${path.join(contracts, 'package.json')}).`);
        console.error('Salin isi folder contracts dari hasil Tahap 2 ke folder ini (lihat panduan), lalu jalankan lagi.');
        results.push({ name: s.name, ok: false, sec: 0 });
        continue;
      }
      const needInstall = !fs.existsSync(path.join(contracts, 'node_modules'));
      ok = run(s, needInstall ? `npm install && ${s.cmd}` : s.cmd).status === 0;
    } else {
      await waitHealth();
      ok = run(s, s.cmd).status === 0;
      // Gagal cepat biasanya berarti server sempat terputus, bukan masalah logika: coba sekali lagi
      if (!ok && Date.now() - t0 < 15000) {
        console.log('\nGagal dalam waktu singkat, menunggu server lalu mencoba sekali lagi...');
        await waitHealth();
        ok = run(s, s.cmd).status === 0;
      }
    }
    results.push({ name: s.name, ok, sec: Math.round((Date.now() - t0) / 1000) });
  }

  console.log('\n==================== Ringkasan ====================');
  for (const r of results) console.log(`${r.ok ? '[LULUS] ' : '[GAGAL] '} ${r.name} (${r.sec} detik)`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\n${failed} tahap gagal. Gulir ke atas untuk melihat rinciannya.` : '\nSemua tahap lulus. Siap demo.');
  process.exit(failed ? 1 : 0);
})();
