import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, CalendarDays, FileText, Settings, Plus } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { INITIAL_BOOKINGS, DEFAULT_SETTINGS } from './data/InitialData';
import type { Booking } from './types/Booking';
import './styles.css';

function App() {
  const [bookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [active, setActive] = useState('dashboard');
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">T</div><div><strong>TAMIMA</strong><span>Hospitality OS</span></div></div>
        <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(id)}><Icon size={18} />{label}</button>)}</nav>
        <div className="sidebar-footer"><span className="status-dot" /> System operational</div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><p className="eyebrow">Operations center</p><h1>{active === 'dashboard' ? 'Good morning, team' : nav.find(n => n.id === active)?.label}</h1></div><button className="primary-button" onClick={() => setActive('bookings')}><Plus size={17} /> New booking</button></header>
        {active === 'dashboard' ? <Dashboard bookings={bookings} settings={DEFAULT_SETTINGS} currencyView="DUAL" onNewBooking={() => setActive('bookings')} onViewBookings={() => setActive('bookings')} onViewVoucher={() => undefined} onOpenCalendar={() => setActive('bookings')} /> : <section className="empty-state"><div className="empty-icon">{nav.find(n => n.id === active)?.icon && (() => { const I = nav.find(n => n.id === active)!.icon; return <I size={30} /> })()}</div><h2>{nav.find(n => n.id === active)?.label} is ready</h2><p>Use the dashboard to monitor bookings, profitability, and daily operations.</p><button className="primary-button" onClick={() => setActive('dashboard')}>Back to dashboard</button></section>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
