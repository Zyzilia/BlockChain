// Antrean serial untuk semua transaksi dari wallet platform.
// Dua transaksi yang dikirim bersamaan dari satu wallet bisa memakai nonce yang sama dan gagal,
// jadi setiap transaksi menunggu yang sebelumnya selesai.
let tail = Promise.resolve();

function enqueue(task) {
  const run = tail.then(task, task);
  tail = run.catch(() => {}); // kegagalan satu tugas tidak menghentikan antrean
  return run;
}

module.exports = { enqueue };
