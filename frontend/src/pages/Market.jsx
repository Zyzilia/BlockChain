import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { usePayment } from '../components/Pay.jsx';
import { Loading, Notice } from '../components/Ui.jsx';
import { dateShort, money } from '../format.js';

// Pasar resale: tiket dari pemilik lain dengan harga yang dibatasi smart contract
export default function Market() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { payOrder, panel } = usePayment();
  const [listings, setListings] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => api('/resale').then((d) => setListings(d.listings)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function buy(l) {
    if (!user) { navigate(`/masuk?next=${encodeURIComponent(location.pathname)}`); return; }
    setBusyId(l.id);
    setError('');
    try {
      const d = await api(`/resale/${l.id}/buy`, { method: 'POST' });
      await payOrder(d.order.id);
    } catch (e) {
      setError(e.message);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h1>Resale</h1>
      <p className="lead">
        Tiket dari pemilik yang berhalangan hadir. Harganya tidak bisa melebihi batas yang dikunci di smart contract,
        jadi tidak ada harga calo di sini.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {panel}
      {!listings && !error && <Loading />}
      {listings && listings.length === 0 && <Notice>Belum ada tiket yang dijual ulang. Pemilik tiket bisa memasangnya dari halaman Tiket saya.</Notice>}
      <div className="events__list">
        {(listings || []).map((l) => (
          <article className="ticket" key={l.id}>
            <div className="ticket__body">
              <div className="ticket__stub">
                <span className="ticket__day">#{l.tokenId}</span>
                <span className="ticket__month">token</span>
              </div>
              <div className="ticket__main">
                <h3>{l.eventName}</h3>
                <p>{dateShort(l.eventDate)}</p>
                <p className="muted">Harga nominal {money(l.faceValueIdr)}, batas jual ulang {money(l.maxResalePriceIdr)}. Plus biaya layanan {money(l.serviceFeeIdr)}.</p>
              </div>
              <div className="ticket__aside">
                <span className="ticket__price">{money(l.priceIdr)}</span>
                <span className="ticket__left">Total {money(l.buyerTotalIdr)}</span>
                <button type="button" className="btn btn--solid btn--sm" onClick={() => buy(l)} disabled={busyId === l.id}>
                  {busyId === l.id ? 'Memproses...' : 'Beli tiket'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
