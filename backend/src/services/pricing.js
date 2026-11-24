// Biaya layanan (business case, Tabel 13):
// Rp5.000 per tiket untuk harga nominal sampai Rp100.000; 5% untuk tiket di atas itu.
function serviceFeePerTicket(faceValueIdr) {
  return faceValueIdr <= 100000 ? 5000 : Math.round(faceValueIdr * 0.05);
}

function calcOrderAmounts(faceValueIdr, quantity) {
  const faceTotal = faceValueIdr * quantity;
  const serviceFee = serviceFeePerTicket(faceValueIdr) * quantity;
  return { faceTotal, serviceFee, total: faceTotal + serviceFee };
}

module.exports = { serviceFeePerTicket, calcOrderAmounts };
