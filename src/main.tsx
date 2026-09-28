import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { INITIAL_BOOKINGS, DEFAULT_SETTINGS } from './data/InitialData';
import type { Booking, Customer } from './types/booking';
import type { LiveExchangeRate } from './utils/exchangeRate';

// Armada Umroh module
import { ArmadaDashboard } from './components/Armada/ArmadaDashboard';
import { ArmadaBookingList } from './components/Armada/ArmadaBookingList';
import { ArmadaBookingForm } from './components/Armada/ArmadaBookingForm';
import { ArmadaCharterVoucher } from './components/Armada/ArmadaCharterVoucher';
import { INITIAL_ARMADA_BOOKINGS } from './data/initialArmadaData';
import type { ArmadaBooking } from './types/armada';
import { generateArmadaRef } from './utils/armadaFinance';
import { exportArmadaToExcel, shareArmadaViaWhatsApp } from './utils/armadaExport';

// Haramain Train module
import { TrainDashboard } from './components/Train/TrainDashboard';
import { TrainBookingList } from './components/Train/TrainBookingList';
import { TrainBookingForm } from './components/Train/TrainBookingForm';
import { TrainTicketPass } from './components/Train/TrainTicketPass';
import { INITIAL_TRAIN_BOOKINGS } from './data/initialTrainData';
import type { TrainBooking } from './types/train';
import { generateTrainRef } from './utils/trainFinance';
import { exportTrainToExcel, shareTrainViaWhatsApp } from './utils/trainExport';

import './styles.css';

type Tab =
  | 'dashboard' | 'bookings' | 'reports' | 'calendar'
  | 'management' | 'train' | 'armada' | 'new-booking' | 'settings';

type ModuleView = 'dash' | 'list' | 'form' | 'doc';

const NO_CUSTOMERS: Customer[] = [];

function App() {
  const [bookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [active, setActive] = useState<Tab>('armada');
  const [currencyView, setCurrencyView] = useState<'DUAL' | 'SAR' | 'IDR'>('DUAL');
  const [darkMode, setDarkMode] = useState(false);
  const settings = DEFAULT_SETTINGS;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const liveRate: LiveExchangeRate = {
    rate: settings.defaultExchangeRateSARtoIDR || 4250,
    updatedAt: new Date().toLocaleString('id-ID'),
    source: 'Configured fallback',
    stale: true,
  };

  // ---- Armada module state ----
  const [armada, setArmada] = useState<ArmadaBooking[]>(INITIAL_ARMADA_BOOKINGS);
  const [armadaView, setArmadaView] = useState<ModuleView>('dash');
  const [armadaEditing, setArmadaEditing] = useState<ArmadaBooking | null>(null);
  const [armadaSelected, setArmadaSelected] = useState<ArmadaBooking | null>(null);

  // ---- Train module state ----
  const [train, setTrain] = useState<TrainBooking[]>(INITIAL_TRAIN_BOOKINGS);
  const [trainView, setTrainView] = useState<ModuleView>('dash');
  const [trainEditing, setTrainEditing] = useState<TrainBooking | null>(null);
  const [trainSelected, setTrainSelected] = useState<TrainBooking | null>(null);

  const go = (tab: Tab) => {
    setActive(tab);
    if (tab === 'armada') setArmadaView('dash');
    if (tab === 'train') setTrainView('dash');
  };

  const renderArmada = () => {
    if (armadaView === 'form') {
      return (
        <ArmadaBookingForm
          initialBooking={armadaEditing}
          settings={settings}
          customers={NO_CUSTOMERS}
          onCancel={() => setArmadaView(armadaEditing ? 'list' : 'dash')}
          onSave={(b, openVoucher) => {
            setArmada((prev) => (prev.some((x) => x.id === b.id) ? prev.map((x) => (x.id === b.id ? b : x)) : [b, ...prev]));
            setArmadaEditing(null);
            if (openVoucher) { setArmadaSelected(b); setArmadaView('doc'); } else { setArmadaView('list'); }
          }}
        />
      );
    }
    if (armadaView === 'doc' && armadaSelected) {
      return (
        <ArmadaCharterVoucher
          booking={armadaSelected}
          settings={settings}
          onBack={() => setArmadaView('list')}
          onEdit={() => { setArmadaEditing(armadaSelected); setArmadaView('form'); }}
        />
      );
    }
    if (armadaView === 'list') {
      return (
        <ArmadaBookingList
          bookings={armada}
          settings={settings}
          currencyView={currencyView}
          onNew={() => { setArmadaEditing(null); setArmadaView('form'); }}
          onViewVoucher={(b) => { setArmadaSelected(b); setArmadaView('doc'); }}
          onEdit={(b) => { setArmadaEditing(b); setArmadaView('form'); }}
          onDuplicate={(b) => {
            const copy: ArmadaBooking = { ...b, id: `amd-${Date.now()}`, armadaRef: generateArmadaRef(), status: 'Unpaid', amountPaidSAR: 0, amountPaidIDR: 0, paymentHistory: [] };
            setArmada((prev) => [copy, ...prev]);
          }}
          onDelete={(id) => setArmada((prev) => prev.filter((x) => x.id !== id))}
          onMarkAsPaid={(id) => setArmada((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'Paid', amountPaidSAR: x.totalSellSAR, amountPaidIDR: x.totalSellIDR } : x)))}
          onExportExcel={(rows) => exportArmadaToExcel(rows)}
          onWhatsApp={(b) => shareArmadaViaWhatsApp(b, settings)}
        />
      );
    }
    return (
      <ArmadaDashboard
        bookings={armada}
        onNew={() => { setArmadaEditing(null); setArmadaView('form'); }}
        onOpenList={() => setArmadaView('list')}
        onViewVoucher={(b) => { setArmadaSelected(b); setArmadaView('doc'); }}
      />
    );
  };

  const renderTrain = () => {
    if (trainView === 'form') {
      return (
        <TrainBookingForm
          initialBooking={trainEditing}
          settings={settings}
          customers={NO_CUSTOMERS}
          onCancel={() => setTrainView(trainEditing ? 'list' : 'dash')}
          onSave={(b, openTicket) => {
            setTrain((prev) => (prev.some((x) => x.id === b.id) ? prev.map((x) => (x.id === b.id ? b : x)) : [b, ...prev]));
            setTrainEditing(null);
            if (openTicket) { setTrainSelected(b); setTrainView('doc'); } else { setTrainView('list'); }
          }}
        />
      );
    }
    if (trainView === 'doc' && trainSelected) {
      return (
        <TrainTicketPass
          booking={trainSelected}
          settings={settings}
          onBack={() => setTrainView('list')}
          onEdit={() => { setTrainEditing(trainSelected); setTrainView('form'); }}
        />
      );
    }
    if (trainView === 'list') {
      return (
        <TrainBookingList
          bookings={train}
          settings={settings}
          currencyView={currencyView}
          onNew={() => { setTrainEditing(null); setTrainView('form'); }}
          onViewTicket={(b) => { setTrainSelected(b); setTrainView('doc'); }}
          onEdit={(b) => { setTrainEditing(b); setTrainView('form'); }}
          onDuplicate={(b) => {
            const copy: TrainBooking = { ...b, id: `tr-${Date.now()}`, trainRef: generateTrainRef(), status: 'Unpaid', amountPaidSAR: 0, amountPaidIDR: 0, paymentHistory: [] };
            setTrain((prev) => [copy, ...prev]);
          }}
          onDelete={(id) => setTrain((prev) => prev.filter((x) => x.id !== id))}
          onMarkAsPaid={(id) => setTrain((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'Paid', amountPaidSAR: x.totalSellSAR, amountPaidIDR: x.totalSellIDR } : x)))}
          onExportExcel={(rows) => exportTrainToExcel(rows)}
          onWhatsApp={(b) => shareTrainViaWhatsApp(b, settings)}
        />
      );
    }
    return (
      <TrainDashboard
        bookings={train}
        onNew={() => { setTrainEditing(null); setTrainView('form'); }}
        onOpenList={() => setTrainView('list')}
        onViewTicket={(b) => { setTrainSelected(b); setTrainView('doc'); }}
      />
    );
  };

  const Placeholder = ({ title }: { title: string }) => (
    <div className="max-w-3xl mx-auto text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 shadow-sm">
      <h2 className="text-xl font-black text-slate-800 dark:text-white">{title}</h2>
      <p className="text-sm text-slate-500 mt-2">Modul ini belum di-wire pada shell demo ini. Modul yang aktif untuk preview: <b>Armada Umroh</b> &amp; <b>Haramain Train</b>.</p>
      <div className="flex justify-center gap-2 mt-5">
        <button onClick={() => go('armada')} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-sm">Buka Armada Umroh</button>
        <button onClick={() => go('dashboard')} className="border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-sm">Dashboard</button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (active) {
      case 'armada': return renderArmada();
      case 'train': return renderTrain();
      case 'dashboard':
        return (
          <Dashboard
            bookings={bookings}
            settings={settings}
            currencyView={currencyView}
            onNewBooking={() => go('armada')}
            onViewBookings={() => go('bookings')}
            onViewVoucher={() => undefined}
            onOpenCalendar={() => go('calendar')}
          />
        );
      case 'bookings': return <Placeholder title="Hotel Bookings" />;
      case 'reports': return <Placeholder title="Reports & Analytics" />;
      case 'calendar': return <Placeholder title="Booking Calendar" />;
      case 'management': return <Placeholder title="Master Management" />;
      case 'new-booking': return <Placeholder title="New Hotel Booking" />;
      case 'settings': return <Placeholder title="Settings & FX" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header
        activeTab={active}
        setActiveTab={go}
        settings={settings}
        liveRate={liveRate}
        openSettings={() => setActive('settings')}
        currencyView={currencyView}
        setCurrencyView={setCurrencyView}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderContent()}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
