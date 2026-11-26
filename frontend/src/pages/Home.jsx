import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Arch from '../components/Arch.jsx';
import TicketCard from '../components/TicketCard.jsx';
import { Loading, Notice } from '../components/Ui.jsx';

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

// Bilah pencari berbentuk pil: pilih event, jumlah, lalu beli
function Finder({ events }) {
  const navigate = useNavigate();
  const [eventId, setEventId] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!eventId && events.length) setEventId(String(events[0].id));
  }, [events, eventId]);

  const chosen = events.find((e) => String(e.id) === eventId);
  const maxQty = chosen ? Math.max(1, Math.min(chosen.maxPerUser, chosen.available)) : 1;
  const safeQty = Math.min(qty, maxQty);

  function submit(e) {
    e.preventDefault();
    if (chosen) navigate(`/event/${chosen.id}?jumlah=${safeQty}`);
  }

  return (
    <form className="finder" onSubmit={submit} aria-label="Cari dan beli tiket">
      <label className="finder__cell">
        <span className="finder__label">Event</span>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={!events.length}>
          {!events.length && <option value="">Belum ada event</option>}
          {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>
      <label className="finder__cell finder__cell--qty">
        <span className="finder__label">Jumlah</span>
        <select value={safeQty} onChange={(e) => setQty(Number(e.target.value))} disabled={!chosen}>
          {Array.from({ length: maxQty }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} tiket</option>)}
        </select>
      </label>
      <button className="finder__go" type="submit" disabled={!chosen}>Beli sekarang</button>
    </form>
  );
}

export default function Home() {
  const now = useNow();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/events').then((d) => setEvents(d.events)).catch((e) => setError(e.message));
  }, []);

  const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
  const month = `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

  return (
    <>
      <section className="hero">
        <div className="hero__text">
          <dl className="clock" aria-label="Waktu dan jaringan">
            <div><dt>Waktu sekarang</dt><dd>{time}</dd></div>
            <div><dt>{month}</dt><dd>{now.getDate()}</dd></div>
            <div><dt>Jaringan uji</dt><dd>Sepolia</dd></div>
          </dl>
          <p className="hero__kicker">Tiket event kampus</p>
          <h1 className="hero__title">Anti-calo</h1>
          <p className="hero__lead">
            Tiap tiket adalah token di blockchain. Harga jual ulang dibatasi 110%, satu akun maksimal 4 tiket,
            dan tiket hanya bisa dipakai sekali. Bayar pakai QRIS, virtual account, atau e-wallet, tanpa perlu paham kripto.
          </p>
          <Finder events={events || []} />
        </div>
        <div className="hero__visual">
          <Arch events={(events || []).slice(0, 2)} />
        </div>
      </section>

      <div className="perforation" aria-hidden="true"><span /></div>

      <section id="event" className="events">
        <h2>Event yang sedang dijual</h2>
        {error && <Notice tone="error">{error}</Notice>}
        {!events && !error && <Loading />}
        {events && events.length === 0 && (
          <Notice>Belum ada event terbit. Penyelenggara membuat dan menerbitkan event dari halaman Panitia.</Notice>
        )}
        <div className="events__list">
          {(events || []).map((e) => <TicketCard key={e.id} event={e} />)}
        </div>
      </section>
    </>
  );
}
