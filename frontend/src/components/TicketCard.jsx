import { Link } from 'react-router-dom';
import { money, monthShort } from '../format.js';

// Kartu event berbentuk tiket: sobekan tanggal di kiri, rincian di tengah, harga di kanan
export default function TicketCard({ event }) {
  const d = new Date(event.eventDate);
  const soldOut = event.available <= 0;
  return (
    <article className="ticket">
      <div className="ticket__body">
        <div className="ticket__stub">
          <span className="ticket__day">{d.getDate()}</span>
          <span className="ticket__month">{monthShort(event.eventDate)}</span>
        </div>
        <div className="ticket__main">
          <h3><Link to={`/event/${event.id}`}>{event.name}</Link></h3>
          <p>{event.venue || 'Lokasi diumumkan penyelenggara'}</p>
          <p className="muted">
            Jual ulang maksimal {money(event.maxResalePriceIdr)}. Maksimal {event.maxPerUser} tiket per akun.
          </p>
        </div>
        <div className="ticket__aside">
          <span className="ticket__price">{money(event.faceValueIdr)}</span>
          <span className="ticket__left">{soldOut ? 'Habis' : `Tersisa ${event.available}`}</span>
          <Link className={`btn btn--solid btn--sm${soldOut ? ' is-disabled' : ''}`} to={`/event/${event.id}`}>
            {soldOut ? 'Lihat event' : 'Beli tiket'}
          </Link>
        </div>
      </div>
    </article>
  );
}
