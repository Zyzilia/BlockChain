import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Frame from './components/Frame.jsx';
import { Loading } from './components/Ui.jsx';
import Home from './pages/Home.jsx';
import EventPage from './pages/EventPage.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Tickets from './pages/Tickets.jsx';
import Market from './pages/Market.jsx';
import Orders from './pages/Orders.jsx';
import Organizer from './pages/Organizer.jsx';
import Scanner from './pages/Scanner.jsx';

// Halaman yang butuh login diarahkan ke /masuk lalu kembali ke halaman semula
function Private({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to={`/masuk?next=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Frame />}>
        <Route index element={<Home />} />
        <Route path="event/:id" element={<EventPage />} />
        <Route path="resale" element={<Market />} />
        <Route path="masuk" element={<Login />} />
        <Route path="daftar" element={<Register />} />
        <Route path="tiket" element={<Private><Tickets /></Private>} />
        <Route path="pesanan" element={<Private><Orders /></Private>} />
        <Route path="panitia" element={<Private><Organizer /></Private>} />
        <Route path="panitia/pindai" element={<Private><Scanner /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
