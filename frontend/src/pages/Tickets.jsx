import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import QrDialog from '../components/QrDialog.jsx';
import { Chip, Loading, Notice } from '../components/Ui.jsx';
import { dateShort, money, resaleBreakdown, ticketStatus } from '../format.js';

// Form pasang tiket untuk dijual ulang. Harga dibatasi, rincian uang ditampilkan sebelum dikirim.
function ResaleForm({ ticket, onDone }) {
  const [ev, setEv] = useState(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/events/${ticket.eventId}`)
      .then((d) => { setEv(d.event); setPrice(String(d.event.faceValueIdr)); })
      .catch((e) => setError(e.message));
  }, [ticket.eventId]);

  if (!ev) return error ? <Notice tone="error">{error}</Notice> : <Loading />;

  const p = Number(price);
  const valid = Number.isInteger(p) && p >= 1000 && p <= ev.maxResalePriceIdr;
  const b = valid ? resaleBreakdown(p, ev.faceValueIdr) : null;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/resale', { method: 'POST', body: { ticketId: ticket.id, priceIdr: p } });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="subform" onSubmit={submit}>
      <label>Harga jual ulang (rupiah)
        <input type="number" inputMode="numeric" min="1000" max={ev.maxResalePriceIdr} step="500" value={price} onChange={(e) => setPrice(e.target.value)} />
        <small>Harga nominal {money(ev.faceValueIdr)}. Batas tertinggi {money(ev.maxResalePriceIdr)}, dikunci di smart contract.</small>
      </label>
      {b && (
        <dl className="sum">
          <div><dt>Komisi platform 5%</dt><dd>-{money(b.commission)}</dd></div>
          <div><dt>Bagian penyelenggara (50% dari selisih)</dt><dd>-{money(b.organizerShare)}</dd></div>
          <div className="sum__total"><dt>Kamu menerima</dt><dd>{money(b.sellerNet)}</dd></div>
        </dl>
      )}
      {!valid && price !== '' && <Notice tone="error">Harga harus antara Rp1.000 dan {money(ev.maxResalePriceIdr)}.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn btn--solid btn--sm" disabled={!valid || busy}>
        {busy ? 'Memasang di blockchain, 10 sampai 30 detik...' : 'Pasang untuk dijual'}
      </button>
    </form>
  );
}

function TicketRow({ ticket, listing, reload }) {
  const [qrOpen, setQrOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [verify, setVerify] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const st = ticketStatus[ticket.status];
  const canUse = ticket.status === 'valid' || ticket.status === 'listed';

  async function check() {
    setBusy(true);
    setError('');
    try { setVerify(await api(`/tickets/${ticket.id}/onchain`)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function cancelSale() {
    setBusy(true);
    setError('');
    try { await api(`/resale/${listing.id}`, { method: 'DELETE' }); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <article className="ticket">
      <div className="ticket__body ticket__body--stack">
        <div className="ticket__stub">
          <span className="ticket__day">{ticket.tokenId !== null ? `#${ticket.tokenId}` : '...'}</span>
          <span className="ticket__month">token</span>
        </div>
        <div className="ticket__main">
          <h3>{ticket.eventName}</h3>
          <p>{dateShort(ticket.eventDate)}</p>
          <p><Chip tone={st.tone}>{st.label}</Chip></p>
          {listing && <p className="muted">Dijual di {money(listing.priceIdr)}</p>}
          {ticket.mintTxUrl && <p><a href={ticket.mintTxUrl} target="_blank" rel="noreferrer">Bukti pencetakan di Etherscan</a></p>}
        </div>
        <div className="ticket__aside ticket__aside--actions">
          {canUse && <button type="button" className="btn btn--solid btn--sm" onClick={() => setQrOpen(true)}>Tampilkan QR</button>}
          {ticket.status === 'valid' && <button type="button" className="btn btn--text" onClick={() => setSellOpen(!sellOpen)}>Jual ulang</button>}
          {ticket.status === 'listed' && listing && <button type="button" className="btn btn--text" onClick={cancelSale} disabled={busy}>Batalkan penjualan</button>}
          {ticket.tokenId !== null && <button type="button" className="btn btn--text" onClick={check} disabled={busy}>Verifikasi di blockchain</button>}
        </div>
      </div>

      {(sellOpen || verify || error) && (
        <div className="ticket__extra">
          {error && <Notice tone="error">{error}</Notice>}
          {verify && (
            <Notice tone={verify.ownerMatches ? 'good' : 'error'}>
              {verify.ownerMatches
                ? `Terverifikasi: blockchain mencatat token #${verify.tokenId} dimiliki wallet kamu${verify.used ? ', dan sudah dipakai' : ', dan belum dipakai'}. `
                : 'Pemilik token di blockchain tidak sesuai dengan wallet kamu. '}
              <a href={verify.nftUrl} target="_blank" rel="noreferrer">Lihat token di Etherscan</a>
            </Notice>
          )}
          {sellOpen && ticket.status === 'valid' && <ResaleForm ticket={ticket} onDone={async () => { setSellOpen(false); await reload(); }} />}
        </div>
      )}
      {qrOpen && <QrDialog ticket={ticket} onClose={() => setQrOpen(false)} />}
    </article>
  );
}

export default function Tickets() {
  const [tickets, setTickets] = useState(null);
  const [listings, setListings] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [t, l] = await Promise.all([api('/tickets'), api('/resale/mine')]);
      setTickets(t.tickets);
      setListings(l.listings.filter((x) => x.status === 'active'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Selama ada tiket yang sedang dicetak, periksa ulang tiap 5 detik
  const waiting = tickets && tickets.some((t) => t.status === 'pending_mint');
  useEffect(() => {
    if (!waiting) return undefined;
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [waiting, load]);

  return (
    <section>
      <h1>Tiket saya</h1>
      {error && <Notice tone="error">{error}</Notice>}
      {!tickets && !error && <Loading />}
      {waiting && <Notice>Ada tiket yang sedang dicetak di blockchain. Halaman ini diperbarui otomatis.</Notice>}
      {tickets && tickets.length === 0 && <Notice>Kamu belum punya tiket. Pilih event di <Link to="/">beranda</Link> atau lihat tiket <Link to="/resale">resale</Link>.</Notice>}
      <div className="events__list">
        {(tickets || []).map((t) => (
          <TicketRow key={t.id} ticket={t} listing={listings.find((l) => l.ticketId === t.id)} reload={load} />
        ))}
      </div>
    </section>
  );
}
