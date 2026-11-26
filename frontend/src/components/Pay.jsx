import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getConfig } from '../api.js';
import { openPayment } from '../payment.js';
import { money, orderStatus } from '../format.js';
import { Chip, Notice } from './Ui.jsx';

// Memantau satu order sampai statusnya berubah (webhook Midtrans memperbaruinya di server)
export function PayTracker({ orderId, redirectUrl }) {
  const [order, setOrder] = useState(null);
  const [note, setNote] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer;
    async function poll() {
      try {
        const d = await api(`/orders/${orderId}`);
        if (!alive) return;
        setOrder(d.order);
        if (d.order.status === 'pending') timer = setTimeout(poll, 3000);
      } catch (_) {
        if (alive) timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [orderId]);

  async function checkNow() {
    setChecking(true);
    setNote('');
    try {
      const d = await api(`/orders/${orderId}/sync`, { method: 'POST' });
      setOrder(d.order);
      if (d.note) setNote(d.note);
    } catch (e) {
      setNote(e.message);
    } finally {
      setChecking(false);
    }
  }

  const st = order ? orderStatus[order.status] : null;
  return (
    <div className="paytrack" aria-live="polite">
      <div className="paytrack__head">
        <strong>Pesanan nomor {orderId}</strong>
        {st && <Chip tone={st.tone}>{st.label}</Chip>}
        {order && <span className="paytrack__total">{money(order.totalIdr)}</span>}
      </div>

      {(!order || order.status === 'pending') && (
        <>
          <p>Selesaikan pembayaran di jendela Midtrans. Halaman ini otomatis berubah begitu pembayaran diterima.</p>
          <p className="paytrack__actions">
            {redirectUrl && <a href={redirectUrl} target="_blank" rel="noreferrer">Buka halaman pembayaran</a>}
            <button type="button" className="btn btn--text" onClick={checkNow} disabled={checking}>
              {checking ? 'Memeriksa...' : 'Periksa status pembayaran'}
            </button>
          </p>
        </>
      )}
      {order && order.status === 'paid' && (
        <p>
          Pembayaran diterima. {order.listingId ? 'Token tiket sedang dipindahkan ke akunmu di blockchain.' : 'Token tiket sedang dicetak di blockchain.'}{' '}
          Biasanya selesai dalam 10 sampai 60 detik. <Link to="/tiket">Lihat tiket saya</Link>
        </p>
      )}
      {order && order.status === 'failed' && <p>Pembayaran gagal. Coba lagi dengan membuat pesanan baru.</p>}
      {order && order.status === 'expired' && <p>Waktu pembayaran habis. Buat pesanan baru, kuota tiketmu sudah dilepas.</p>}
      {note && <p className="muted">{note}</p>}
    </div>
  );
}

// Hook: memulai pembayaran sebuah order lalu menampilkan pelacaknya
export function usePayment() {
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');

  const payOrder = useCallback(async (orderId) => {
    setError('');
    try {
      const d = await api(`/orders/${orderId}/pay`, { method: 'POST' });
      setActive({ orderId, redirectUrl: d.payment.redirectUrl });
      const cfg = await getConfig();
      await openPayment(d.payment, cfg && cfg.midtransClientKey);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const panel = (
    <>
      {error && <Notice tone="error">{error}</Notice>}
      {active && <PayTracker key={active.orderId} orderId={active.orderId} redirectUrl={active.redirectUrl} />}
    </>
  );
  return { payOrder, panel };
}
