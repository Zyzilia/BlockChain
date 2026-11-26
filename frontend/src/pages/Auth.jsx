import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Notice } from '../components/Ui.jsx';

function useAfterAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (user) => {
    const next = params.get('next');
    if (next && next.startsWith('/')) navigate(next);
    else navigate(user.role === 'organizer' ? '/panitia' : '/');
  };
}

export function Login() {
  const { login } = useAuth();
  const after = useAfterAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { after(await login(form.email, form.password)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="auth panel">
      <h1>Masuk</h1>
      <form onSubmit={submit}>
        <label>Email kampus
          <input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn btn--solid" disabled={busy}>{busy ? 'Masuk...' : 'Masuk'}</button>
      </form>
      <p>Belum punya akun? <Link to="/daftar">Daftar di sini</Link></p>
    </section>
  );
}

export function Register() {
  const { register } = useAuth();
  const after = useAfterAuth();
  const [form, setForm] = useState({ name: '', email: '', nim: '', password: '', role: 'buyer' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { after(await register(form)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="auth panel">
      <h1>Daftar</h1>
      <form onSubmit={submit}>
        <label>Nama lengkap
          <input required minLength={2} autoComplete="name" value={form.name} onChange={set('name')} />
        </label>
        <label>Email kampus
          <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
          <small>Harus email kampus berakhiran .ac.id</small>
        </label>
        <label>NIM
          <input required inputMode="numeric" pattern="[0-9]{8,20}" value={form.nim} onChange={set('nim')} />
          <small>Hanya disimpan dalam bentuk hash. Satu NIM untuk satu akun. Gunakan data dummy.</small>
        </label>
        <label>Password
          <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
        </label>
        <label>Daftar sebagai
          <select value={form.role} onChange={set('role')}>
            <option value="buyer">Pembeli</option>
            <option value="organizer">Penyelenggara (untuk demo)</option>
          </select>
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <button className="btn btn--solid" disabled={busy}>{busy ? 'Mendaftar...' : 'Daftar'}</button>
      </form>
      <p>Sudah punya akun? <Link to="/masuk">Masuk</Link></p>
    </section>
  );
}
