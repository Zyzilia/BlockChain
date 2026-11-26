import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Notice } from '../components/Ui.jsx';

// Halaman petugas pintu masuk: pindai QR dengan kamera (bila browser mendukung) atau tempel kodenya
export default function Scanner() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState('');
  const videoRef = useRef(null);
  const hasCamera = typeof window !== 'undefined' && 'BarcodeDetector' in window && navigator.mediaDevices;

  async function submit(qr) {
    const value = (qr || '').trim();
    if (!value) return;
    setBusy(true);
    setResult(null);
    try {
      const d = await api('/checkin', { method: 'POST', body: { qr: value } });
      setResult({ ok: true, data: d });
      setCode('');
    } catch (e) {
      setResult({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!camOn) return undefined;
    let stream;
    let timer;
    let stopped = false;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = setInterval(async () => {
          try {
            const found = await detector.detect(videoRef.current);
            if (found.length) { clearInterval(timer); setCamOn(false); submit(found[0].rawValue); }
          } catch (_) { /* bingkai belum siap */ }
        }, 400);
      } catch (e) {
        setCamError(`Kamera tidak bisa dibuka: ${e.message}`);
        setCamOn(false);
      }
    })();
    return () => { stopped = true; clearInterval(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, [camOn]);

  if (user && user.role !== 'organizer') return <Notice>Halaman ini hanya untuk akun penyelenggara.</Notice>;

  return (
    <section className="scanner">
      <h1>Pindai tiket</h1>
      <p className="lead">Pindai QR dari tiket pengunjung. Keputusan masuk atau tolak keluar dalam hitungan milidetik, pencatatan di blockchain menyusul di latar belakang.</p>

      <div className="panel">
        {hasCamera ? (
          <>
            {camOn && <video ref={videoRef} className="scanner__video" muted playsInline aria-label="Pratinjau kamera" />}
            <button type="button" className="btn btn--solid" onClick={() => { setCamError(''); setCamOn(!camOn); }}>
              {camOn ? 'Tutup kamera' : 'Buka kamera'}
            </button>
            {camError && <Notice tone="error">{camError}</Notice>}
          </>
        ) : (
          <Notice>Browser ini belum mendukung pemindaian kamera. Tempel kode QR di kolom bawah (tombol Salin kode QR ada di tampilan QR pemilik tiket).</Notice>
        )}
        <form onSubmit={(e) => { e.preventDefault(); submit(code); }}>
          <label>Kode QR
            <textarea rows="3" value={code} onChange={(e) => setCode(e.target.value)} placeholder="TA1.12.29512345.AbCd..." spellCheck="false" />
          </label>
          <button className="btn btn--solid" disabled={busy || !code.trim()}>{busy ? 'Memeriksa...' : 'Periksa tiket'}</button>
        </form>
      </div>

      {result && result.ok && (
        <div className="verdict verdict--ok" role="status">
          <h2>Tiket sah, silakan masuk</h2>
          <p>{result.data.ticket.holderName}</p>
          <p>{result.data.ticket.eventName}, token #{result.data.ticket.tokenId}</p>
          <p className="muted">Gerbang menjawab dalam {result.data.elapsedMs} ms. Pencatatan di blockchain menyusul.</p>
        </div>
      )}
      {result && !result.ok && (
        <div className="verdict verdict--bad" role="alert">
          <h2>Tiket ditolak</h2>
          <p>{result.message}</p>
        </div>
      )}
    </section>
  );
}
