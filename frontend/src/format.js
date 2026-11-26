const numberId = new Intl.NumberFormat('id-ID');

export const money = (n) => `Rp${numberId.format(n)}`;

export const dateLong = (iso) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const dateShort = (iso) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

export const monthShort = (iso) => new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(iso));

// Nama yang dipakai pengguna untuk status dari backend
export const ticketStatus = {
  pending_mint: { label: 'Sedang dicetak', tone: 'wait' },
  valid: { label: 'Valid', tone: 'good' },
  listed: { label: 'Dijual', tone: 'info' },
  used: { label: 'Sudah dipakai', tone: 'neutral' },
};

export const orderStatus = {
  pending: { label: 'Menunggu pembayaran', tone: 'wait' },
  paid: { label: 'Dibayar', tone: 'good' },
  failed: { label: 'Gagal', tone: 'bad' },
  expired: { label: 'Kedaluwarsa', tone: 'neutral' },
  refunded: { label: 'Dikembalikan', tone: 'neutral' },
};

// Sama dengan perhitungan di backend (komisi 5%, bagian penyelenggara 50% dari selisih)
export function resaleBreakdown(price, face) {
  const commission = Math.round(price * 0.05);
  const organizerShare = Math.floor((Math.max(0, price - face) * 5000) / 10000);
  return { commission, organizerShare, sellerNet: price - commission - organizerShare };
}
