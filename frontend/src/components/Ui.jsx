export function Notice({ tone = 'info', children }) {
  return (
    <p className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function Chip({ tone = 'neutral', children }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

export function Loading({ children = 'Memuat...' }) {
  return <p className="muted loading">{children}</p>;
}

// Tanda bintang empat sudut, dipakai sebagai logo kecil dan penanda
export function Star({ size = 22, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1 L14.2 9.8 L23 12 L14.2 14.2 L12 23 L9.8 14.2 L1 12 L9.8 9.8 Z" fill="currentColor" />
    </svg>
  );
}
