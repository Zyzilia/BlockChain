const TOKEN_KEY = 'ta_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Semua permintaan ke backend lewat sini. Token login dikirim otomatis.
export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (_) {
    throw new ApiError(0, 'Tidak bisa menghubungi server. Pastikan backend menyala (npm run dev di folder backend).');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event('ta-logout'));
    }
    throw new ApiError(res.status, (data && data.error) || `Permintaan gagal (${res.status})`);
  }
  return data;
}

let configPromise = null;
// Konfigurasi publik (Client Key Midtrans, alamat contract). Diambil sekali.
export function getConfig() {
  if (!configPromise) configPromise = api('/config').catch(() => ({}));
  return configPromise;
}
