import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { getConfig } from '../api.js';
import { Star } from './Ui.jsx';

export default function Frame() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState({});

  useEffect(() => { getConfig().then(setCfg); }, []);

  const links = [{ to: '/', label: 'Beranda', end: true }, { to: '/resale', label: 'Resale' }];
  if (user && user.role === 'buyer') links.push({ to: '/tiket', label: 'Tiket saya' }, { to: '/pesanan', label: 'Pesanan' });
  if (user && user.role === 'organizer') links.push({ to: '/panitia', label: 'Panitia' }, { to: '/panitia/pindai', label: 'Pindai tiket' });

  return (
    <div className="shell">
      <header className="nav">
        <Link to="/" className="nav__brand" aria-label="TiketAman, ke beranda">
          <span className="nav__mark"><Star size={26} /></span>
          <span className="nav__name">TiketAman</span>
        </Link>

        <button type="button" className="nav__toggle" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}>
          Menu
        </button>
        <nav id="menu" className={`nav__links${open ? ' is-open' : ''}`} onClick={() => setOpen(false)}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="nav__account">
          <svg className="nav__bracket" viewBox="0 0 260 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 2 H252 L208 58 H0" fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
          {user ? (
            <>
              <span className="nav__user">{user.name.split(' ')[0]}</span>
              <button type="button" className="btn btn--solid btn--sm" onClick={() => { logout(); navigate('/'); }}>Keluar</button>
            </>
          ) : (
            <Link className="btn btn--solid btn--sm" to="/masuk">Masuk</Link>
          )}
        </div>
      </header>

      <aside className="rail" aria-label="Tautan luar">
        <a href="https://github.com/Zyzilia/BlockChain" target="_blank" rel="noreferrer">GitHub</a>
        {cfg.contractAddress && (
          <a href={`${cfg.explorer}/address/${cfg.contractAddress}`} target="_blank" rel="noreferrer">Etherscan</a>
        )}
        <a href="https://docs.midtrans.com" target="_blank" rel="noreferrer">Midtrans</a>
      </aside>

      <main className="page" id="isi">
        <Outlet />
      </main>

      <footer className="foot">
        <p>TiketAman adalah prototipe tugas kuliah. Hanya memakai Midtrans sandbox dan jaringan uji Sepolia, tanpa uang sungguhan.</p>
      </footer>
    </div>
  );
}
