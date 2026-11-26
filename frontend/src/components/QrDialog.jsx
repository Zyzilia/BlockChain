import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Notice } from './Ui.jsx';

// QR tiket yang berganti tiap 60 detik. Memuat ulang sendiri tepat saat QR lama habis.
export default function QrDialog({ ticket, onClose }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer;
    async function load() {
      try {
        const d = await api(`/tickets/${ticket.id}/qr`);
        if (!alive) return;
        setQr(d);
        setError('');
        timer = setTimeout(load, Math.max(1, d.refreshInSeconds) * 1000);
      } catch (e) {
        if (alive) setError(e.message);
      }
    }
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [ticket.id]);

  useEffect(() => {
    if (!qr) return undefined;
    const tick = () => setLeft(Math.max(0, Math.round((Date.parse(qr.expiresAt) - Date.now()) / 1000)));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [qr]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(qr.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) { /* clipboard tidak tersedia */ }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`QR tiket ${ticket.eventName}`} onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <h2>{ticket.eventName}</h2>
        {error && <Notice tone="error">{error}</Notice>}
        {qr && (
          <>
            <img className="modal__qr" src={qr.qrDataUrl} alt="Kode QR tiket" width="260" height="260" />
            <p className="modal__timer">QR berganti dalam <strong>{left}</strong> detik</p>
            <p className="muted">Tunjukkan ke petugas di pintu masuk. Jangan dibagikan, tiket hanya bisa dipakai sekali.</p>
            <button type="button" className="btn btn--text" onClick={copy}>{copied ? 'Tersalin' : 'Salin kode QR (untuk uji tanpa kamera)'}</button>
          </>
        )}
        {!qr && !error && <p className="muted">Membuat QR...</p>}
        <button type="button" className="btn btn--solid" onClick={onClose}>Tutup</button>
      </div>
    </div>
  );
}
