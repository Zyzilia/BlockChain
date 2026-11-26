import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Chip, Loading, Notice } from '../components/Ui.jsx';
import { dateShort, money } from '../format.js';

const pad = (n) => String(n).padStart(2, '0');
function defaultDate() {
  const d = new Date(Date.now() + 30 * 864e5);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`;
}

export default function Organizer() {
  const { user } = useAuth();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ name: '', venue: '', eventDate: defaultDate(), faceValueIdr: '75000', capacity: '100', maxPerUser: '4', maxResalePct: '110' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(() => api('/events/mine').then((d) => setEvents(d.events)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (user && user.role !== 'organizer') return <Notice>Halaman ini hanya untuk akun penyelenggara.</Notice>;

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/events', {
        method: 'POST',
        body: {
          name: form.name,
          venue: form.venue || null,
          eventDate: new Date(form.eventDate).toISOString(),
          faceValueIdr: Number(form.faceValueIdr),
          capacity: Number(form.capacity),
          maxPerUser: Number(form.maxPerUser),
          maxResaleBps: Math.round(Number(form.maxResalePct) * 100),
        },
      });
      setForm({ ...form, name: '', venue: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function publish(id) {
    setBusyId(id);
    setError('');
    try { await api(`/events/${id}/publish`, { method: 'POST' }); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  }

  return (
    <section>
      <h1>Panitia</h1>
      <p className="lead">Buat event, lalu terbitkan. Saat diterbitkan, harga, kuota, dan batas jual ulang dikunci di smart contract dan tidak bisa diubah lagi.</p>
      {error && <Notice tone="error">{error}</Notice>}

      <div className="split">
        <form className="panel" onSubmit={create}>
          <h2>Event baru</h2>
          <label>Nama event<input required minLength={3} value={form.name} onChange={set('name')} /></label>
          <label>Lokasi<input value={form.venue} onChange={set('venue')} /></label>
          <label>Tanggal dan jam<input type="datetime-local" required value={form.eventDate} onChange={set('eventDate')} /></label>
          <label>Harga tiket (rupiah)<input type="number" required min="1000" step="500" value={form.faceValueIdr} onChange={set('faceValueIdr')} /></label>
          <label>Jumlah tiket<input type="number" required min="1" value={form.capacity} onChange={set('capacity')} /></label>
          <label>Maksimal tiket per akun<input type="number" required min="1" max="10" value={form.maxPerUser} onChange={set('maxPerUser')} /></label>
          <label>Batas harga jual ulang (persen dari nominal)<input type="number" required min="100" max="200" value={form.maxResalePct} onChange={set('maxResalePct')} /></label>
          <button className="btn btn--solid" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan sebagai draft'}</button>
        </form>

        <div>
          <h2>Event saya</h2>
          {!events && !error && <Loading />}
          {events && events.length === 0 && <Notice>Belum ada event. Isi formulir di samping untuk membuat yang pertama.</Notice>}
          <ul className="rows rows--tall">
            {(events || []).map((ev) => (
              <li key={ev.id}>
                <div>
                  <strong>{ev.name}</strong>
                  <span className="muted">{dateShort(ev.eventDate)}, {money(ev.faceValueIdr)}, {ev.sold} dari {ev.capacity} terjual</span>
                  {ev.createTxUrl && <a href={ev.createTxUrl} target="_blank" rel="noreferrer">Bukti di Etherscan</a>}
                </div>
                <Chip tone={ev.status === 'published' ? 'good' : 'wait'}>{ev.status === 'published' ? 'Terbit' : 'Draft'}</Chip>
                {ev.status === 'draft' ? (
                  <button type="button" className="btn btn--solid btn--sm" onClick={() => publish(ev.id)} disabled={busyId === ev.id}>
                    {busyId === ev.id ? 'Mengunci di blockchain, 10 sampai 30 detik...' : 'Terbitkan'}
                  </button>
                ) : <Link to={`/event/${ev.id}`}>Lihat halaman</Link>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
