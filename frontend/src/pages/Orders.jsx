import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { usePayment } from '../components/Pay.jsx';
import { Chip, Loading, Notice } from '../components/Ui.jsx';
import { money, orderStatus } from '../format.js';

export default function Orders() {
  const { payOrder, panel } = usePayment();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/orders').then((d) => setOrders(d.orders)).catch((e) => setError(e.message));
  }, []);

  return (
    <section>
      <h1>Pesanan saya</h1>
      {error && <Notice tone="error">{error}</Notice>}
      {panel}
      {!orders && !error && <Loading />}
      {orders && orders.length === 0 && <Notice>Belum ada pesanan. Pilih event di <Link to="/">beranda</Link>.</Notice>}
      <ul className="rows">
        {(orders || []).map((o) => {
          const st = orderStatus[o.status];
          const stillOpen = o.status === 'pending' && Date.parse(o.expiresAt) > Date.now();
          return (
            <li key={o.id}>
              <div>
                <strong>{o.eventName}</strong>
                <span className="muted">{o.listingId ? 'Tiket resale' : `${o.quantity} tiket`}, pesanan nomor {o.id}</span>
              </div>
              <span className="rows__money">{money(o.totalIdr)}</span>
              <Chip tone={st.tone}>{st.label}</Chip>
              {stillOpen ? (
                <button type="button" className="btn btn--text" onClick={() => payOrder(o.id)}>Lanjut bayar</button>
              ) : <span />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
