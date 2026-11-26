let snapPromise = null;

// Memuat Snap.js Midtrans (sandbox). Mengembalikan false bila gagal sehingga ada cadangan membuka tab.
export function loadSnap(clientKey) {
  if (!clientKey) return Promise.resolve(false);
  if (window.snap) return Promise.resolve(true);
  if (!snapPromise) {
    snapPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
      s.setAttribute('data-client-key', clientKey);
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }
  return snapPromise;
}

// Membuka pembayaran: popup Snap bila tersedia, kalau tidak halaman pembayaran di tab baru.
export async function openPayment(payment, clientKey) {
  const ready = await loadSnap(clientKey);
  if (ready && window.snap) {
    window.snap.pay(payment.token, { onSuccess() {}, onPending() {}, onError() {}, onClose() {} });
    return 'popup';
  }
  window.open(payment.redirectUrl, '_blank', 'noopener');
  return 'tab';
}
