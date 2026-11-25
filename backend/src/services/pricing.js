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

// Pembagian hasil penjualan ulang (business case, Tabel 13 dan 15):
//  - komisi platform 5% dari harga resale, dipotong dari penerimaan penjual
//  - penyelenggara menerima 50% dari selisih harga di atas nominal (sama dengan rumus di smart contract)
function resaleBreakdown(priceIdr, faceValueIdr) {
  const commission = Math.round(priceIdr * 0.05);
  const organizerShare = Math.floor((Math.max(0, priceIdr - faceValueIdr) * 5000) / 10000);
  return { commission, organizerShare, sellerNet: priceIdr - commission - organizerShare };
}

module.exports = { serviceFeePerTicket, calcOrderAmounts, resaleBreakdown };
