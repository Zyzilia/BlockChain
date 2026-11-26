import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { usePayment } from '../components/Pay.jsx';
import { Loading, Notice, Star } from '../components/Ui.jsx';
import { dateLong, money } from '../format.js';

export default function EventPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { payOrder, panel } = usePayment();

  const [ev, setEv] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [qty, setQty] = useState(Math.max(1, Number(params.get('jumlah')) || 1));
  const [busy, setBusy] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    api(`/events/${id}`).then((d) => setEv(d.event)).catch((e) => setLoadError(e.message));
  }, [id]);

  if (loadError) return <Notice tone="error">{loadError}</Notice>;
  if (!ev) return <Loading />;

  const maxQty = Math.max(1, Math.min(ev.maxPerUser, ev.available));
  const q = Math.min(qty, maxQty);
  const fee = ev.serviceFeePerTicketIdr * q;
  const total = ev.faceValueIdr * q + fee;
  const soldOut = ev.available <= 0;

  async function buy() {
    if (!user) { navigate(`/masuk?next=${encodeURIComponent(location.pathname)}`); return; }
    setBusy(true);
    setBuyError('');
    try {
      const d = await api('/orders', { method: 'POST', body: { eventId: ev.id, quantity: q } });
      await payOrder(d.order.id);
    } catch (e) {
      setBuyError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail">
      <div className="detail__main">
        <p className="back"><Link to="/">Kembali ke daftar event</Link></p>
        <h1 className="detail__title">{ev.name}</h1>
        <p className="detail__when">{dateLong(ev.eventDate)}</p>
        <p>{ev.venue || 'Lokasi diumumkan penyelenggara'}. Diselenggarakan oleh {ev.organizerName}.</p>

        <section className="panel" aria-label="Beli tiket">
          <h2>Beli tiket</h2>
          {soldOut ? (
            <Notice>Tiket event ini sudah habis. Cek halaman <Link to="/resale">Resale</Link> untuk tiket dari pemilik lain.</Notice>
          ) : (
            <>
              <div className="stepper">
                <span id="qty-label">Jumlah tiket</span>
                <div role="group" aria-labelledby="qty-label">
                  <button type="button" aria-label="Kurangi jumlah" onClick={() => setQty(Math.max(1, q - 1))} disabled={q <= 1}>-</button>
                  <output aria-live="polite">{q}</output>
                  <button type="button" aria-label="Tambah jumlah" onClick={() => setQty(Math.min(maxQty, q + 1))} disabled={q >= maxQty}>+</button>
                </div>
              </div>
              <dl className="sum">
                <div><dt>{q} x tiket {money(ev.faceValueIdr)}</dt><dd>{money(ev.faceValueIdr * q)}</dd></div>
                <div><dt>Biaya layanan</dt><dd>{money(fee)}</dd></div>
                <div className="sum__total"><dt>Total bayar</dt><dd>{money(total)}</dd></div>
              </dl>
              {user && user.role !== 'buyer' && <Notice>Akun penyelenggara tidak bisa membeli tiket. Masuk dengan akun pembeli.</Notice>}
              {buyError && <Notice tone="error">{buyError}</Notice>}
              <button type="button" className="btn btn--solid" onClick={buy} disabled={busy || (user && user.role !== 'buyer')}>
                {busy ? 'Membuat pesanan...' : user ? 'Beli dan bayar' : 'Masuk untuk membeli'}
              </button>
              <p className="muted">Pembayaran lewat Midtrans sandbox (QRIS, virtual account, e-wallet). Tidak ada uang sungguhan.</p>
            </>
          )}
          {panel}
        </section>
      </div>

      <aside className="detail__side">
        <div className="rules">
          <h2 className="rules__title"><Star size={24} className="arch__star" />Aturan anti-calo</h2>
          <ul>
            <li><span>{money(ev.maxResalePriceIdr)}</span>Harga jual ulang tertinggi ({ev.maxResaleBps / 100}% dari nominal)</li>
            <li><span>{ev.maxPerUser} tiket</span>Batas per akun untuk event ini</li>
            <li><span>1 kali</span>Setiap tiket hanya bisa dipakai sekali masuk</li>
          </ul>
          <p>Aturan ini dikunci di smart contract saat event diterbitkan dan tidak bisa diubah, bahkan oleh platform.</p>
          {ev.createTxUrl && <a href={ev.createTxUrl} target="_blank" rel="noreferrer">Lihat buktinya di Etherscan</a>}
        </div>
      </aside>
    </div>
  );
}
