import { Link } from 'react-router-dom';
import { money } from '../format.js';
import { Star } from './Ui.jsx';

// Lingkaran bergambar dengan teks melengkung dan kartu lengkung gelap berisi event terdekat
export default function Arch({ events }) {
  return (
    <div className="arch">
      <svg className="arch__ring" viewBox="0 0 340 200" aria-hidden="true">
        <defs>
          <path id="arc" d="M 22 190 A 148 148 0 0 1 318 190" />
        </defs>
        <text>
          <textPath href="#arc" startOffset="50%" textAnchor="middle">Tiket asli, harga wajar, tanpa calo</textPath>
        </text>
      </svg>

      <svg className="arch__disc" viewBox="0 0 200 200" role="img" aria-label="Ilustrasi tiket di langit senja">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2C9FB0" />
            <stop offset="0.55" stopColor="#8FC3B8" />
            <stop offset="1" stopColor="#F59A62" />
          </linearGradient>
          <clipPath id="disc"><circle cx="100" cy="100" r="100" /></clipPath>
        </defs>
        <g clipPath="url(#disc)">
          <rect width="200" height="200" fill="url(#sky)" />
          <path d="M-10 128 C 30 112, 60 140, 100 126 S 170 118, 214 134 V 210 H-10 Z" fill="#E8805A" opacity="0.55" />
          <g transform="translate(96 88) rotate(-14)">
            <path d="M-44 -22 H44 V-8 a9 9 0 0 0 0 16 V22 H-44 V8 a9 9 0 0 0 0 -16 Z" fill="#1F1F24" />
            <line x1="14" y1="-18" x2="14" y2="18" stroke="#F6F0E0" strokeWidth="2" strokeDasharray="4 4" />
            <rect x="-34" y="-8" width="34" height="5" rx="2.5" fill="#F6F0E0" opacity="0.9" />
            <rect x="-34" y="3" width="22" height="5" rx="2.5" fill="#8C6AE6" />
          </g>
          <circle cx="150" cy="46" r="3" fill="#FFFCF0" opacity="0.9" />
          <circle cx="52" cy="40" r="2" fill="#FFFCF0" opacity="0.8" />
        </g>
      </svg>

      <div className="arch__card">
        <h2 className="arch__title"><Star size={26} className="arch__star" />Segera berlangsung</h2>
        {events.length === 0 && <p className="arch__empty">Belum ada event terbit. Penyelenggara bisa membuatnya di halaman Panitia.</p>}
        <ul className="arch__list">
          {events.map((e) => (
            <li key={e.id}>
              <Link to={`/event/${e.id}`}>
                <span className="arch__price">{money(e.faceValueIdr)}</span>
                <span className="arch__name">{e.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
