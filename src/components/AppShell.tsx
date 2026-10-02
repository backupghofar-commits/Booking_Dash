'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from './Header';
import { Dashboard } from './Dashboard';
import { BookingsList } from './BookingsList';
import { BookingForm } from './BookingForm';
import { ConfirmationLetter } from './ConfirmationLetter';
import { BookingCalendar } from './BookingCalendar';
import { Reports } from './Reports';
import { DirectoryManagement } from './DirectoryManagement';
import { SettingsModal } from './SettingsModal';
import dynamic from 'next/dynamic';

const ImportExcel = dynamic(() => import('./ImportExcel').then((m) => m.ImportExcel), { ssr: false });
import { ArmadaDashboard } from './Armada/ArmadaDashboard';
import { ArmadaBookingList } from './Armada/ArmadaBookingList';
import { ArmadaBookingForm } from './Armada/ArmadaBookingForm';
import { ArmadaCharterVoucher } from './Armada/ArmadaCharterVoucher';
import { TrainDashboard } from './Train/TrainDashboard';
import { TrainBookingList } from './Train/TrainBookingList';
import { TrainBookingForm } from './Train/TrainBookingForm';
import { TrainTicketPass } from './Train/TrainTicketPass';
import { UsersPanel } from './UsersPanel';
import { AuditPanel } from './AuditPanel';
import { DEFAULT_SETTINGS } from '@/data/InitialData';
import type { Booking, CompanySettings, Customer, ProductRecord, VendorRecord, VisaAction } from '@/types/booking';
import type { ArmadaBooking } from '@/types/armada';
import type { TrainBooking } from '@/types/train';
import type { LiveExchangeRate } from '@/utils/exchangeRate';
import { generateArmadaRef } from '@/utils/armadaFinance';
import { generateTrainRef } from '@/utils/trainFinance';
import { generateInvoiceRef } from '@/utils/invoiceRef';
import { exportArmadaToExcel, shareArmadaViaWhatsApp } from '@/utils/armadaExport';
import { exportTrainToExcel, shareTrainViaWhatsApp } from '@/utils/trainExport';
import { api, ApiError } from '@/lib/client-api';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import type { AuthUser } from '@/lib/auth/session';

type Tab =
  | 'dashboard'
  | 'bookings'
  | 'reports'
  | 'calendar'
  | 'management'
  | 'train'
  | 'armada'
  | 'new-booking'
  | 'settings'
  | 'users'
  | 'audit';

type ModuleView = 'dash' | 'list' | 'form' | 'doc' | 'import';

export function AppShell({ initialUser }: { initialUser: AuthUser }) {
  const [user, setUser] = useState(initialUser);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [active, setActive] = useState<Tab>('dashboard');
  const [currencyView, setCurrencyView] = useState<'DUAL' | 'SAR' | 'IDR'>('DUAL');
  const [darkMode, setDarkMode] = useState(false);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [liveRate, setLiveRate] = useState<LiveExchangeRate>({
    rate: DEFAULT_SETTINGS.defaultExchangeRateSARtoIDR,
    updatedAt: new Date().toISOString(),
    source: 'Configured fallback',
    stale: true,
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [hotelView, setHotelView] = useState<ModuleView>('list');
  const [hotelEditing, setHotelEditing] = useState<Booking | null>(null);
  const [hotelSelected, setHotelSelected] = useState<Booking | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [armada, setArmada] = useState<ArmadaBooking[]>([]);
  const [armadaView, setArmadaView] = useState<ModuleView>('dash');
  const [armadaEditing, setArmadaEditing] = useState<ArmadaBooking | null>(null);
  const [armadaSelected, setArmadaSelected] = useState<ArmadaBooking | null>(null);

  const [train, setTrain] = useState<TrainBooking[]>([]);
  const [trainView, setTrainView] = useState<ModuleView>('dash');
  const [trainEditing, setTrainEditing] = useState<TrainBooking | null>(null);
  const [trainSelected, setTrainSelected] = useState<TrainBooking | null>(null);

  const can = (p: Permission) => hasPermission(user.role, p);
  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    try {
      const data = await api<{
        user: AuthUser;
        settings: CompanySettings;
        bookings: Booking[];
        train: TrainBooking[];
        armada: ArmadaBooking[];
        customers: Customer[];
        vendors: VendorRecord[];
        products: ProductRecord[];
        liveRate: LiveExchangeRate;
      }>('/api/bootstrap');
      setUser(data.user);
      setSettings(data.settings);
      setBookings(data.bookings);
      setTrain(data.train);
      setArmada(data.armada);
      setCustomers(data.customers);
      setVendors(data.vendors);
      setProducts(data.products);
      setLiveRate(data.liveRate);
      setLoadError(null);
      setBootstrapped(true);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load workspace');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const persistHotel = async (b: Booking) => {
    const existing = bookings.some((x) => x.id === b.id);
    const data = await api<{ booking: Booking }>(existing ? `/api/bookings/${b.id}` : '/api/bookings', {
      method: existing ? 'PUT' : 'POST',
      body: JSON.stringify(b),
    });
    setBookings((prev) => (existing ? prev.map((x) => (x.id === data.booking.id ? data.booking : x)) : [data.booking, ...prev]));
    return data.booking;
  };

  const persistTrain = async (b: TrainBooking) => {
    const existing = train.some((x) => x.id === b.id);
    const data = await api<{ booking: TrainBooking }>(existing ? `/api/train/${b.id}` : '/api/train', {
      method: existing ? 'PUT' : 'POST',
      body: JSON.stringify(b),
    });
    setTrain((prev) => (existing ? prev.map((x) => (x.id === data.booking.id ? data.booking : x)) : [data.booking, ...prev]));
    return data.booking;
  };

  const persistArmada = async (b: ArmadaBooking) => {
    const existing = armada.some((x) => x.id === b.id);
    const data = await api<{ booking: ArmadaBooking }>(existing ? `/api/armada/${b.id}` : '/api/armada', {
      method: existing ? 'PUT' : 'POST',
      body: JSON.stringify(b),
    });
    setArmada((prev) => (existing ? prev.map((x) => (x.id === data.booking.id ? data.booking : x)) : [data.booking, ...prev]));
    return data.booking;
  };

  const go = (tab: Tab) => {
    setActive(tab);
    if (tab === 'armada') setArmadaView('dash');
    if (tab === 'train') setTrainView('dash');
    if (tab === 'bookings') setHotelView('list');
    if (tab === 'new-booking') {
      setHotelEditing(null);
      setHotelView('form');
    }
  };

  const guarded = (permission: Permission, fn: () => void | Promise<void>) => {
    if (!can(permission)) {
      flash('You do not have permission for this action');
      return;
    }
    void fn();
  };

  const renderHotel = () => {
    if (hotelView === 'form' || active === 'new-booking') {
      return (
        <BookingForm
          initialBooking={hotelEditing}
          settings={settings}
          customers={customers}
          onCancel={() => {
            setHotelEditing(null);
            go('bookings');
          }}
          onSave={(b, openVoucher) => {
            guarded('bookings.update', async () => {
              const saved = await persistHotel(b);
              setHotelEditing(null);
              flash(`Saved ${saved.bookingRef}`);
              if (openVoucher) {
                setHotelSelected(saved);
                setHotelView('doc');
                setActive('bookings');
              } else {
                go('bookings');
              }
            });
          }}
        />
      );
    }
    if (hotelView === 'doc' && hotelSelected) {
      return (
        <ConfirmationLetter
          booking={hotelSelected}
          settings={settings}
          onBack={() => setHotelView('list')}
          onEdit={() => {
            setHotelEditing(hotelSelected);
            setHotelView('form');
          }}
        />
      );
    }
    if (hotelView === 'import') {
      return (
        <ImportExcel
          existing={bookings}
          settings={settings}
          onBack={() => setHotelView('list')}
          onImport={(rows) => {
            void (async () => {
              const res = await api<{ committed: number; rejected: number }>('/api/bookings/import', {
                method: 'POST',
                body: JSON.stringify({ bookings: rows }),
              });
              flash(`Imported ${res.committed}, rejected ${res.rejected}`);
              await load();
            })();
            return { committed: rows.length, rejected: 0 };
          }}
        />
      );
    }
    return (
      <BookingsList
        bookings={bookings}
        settings={settings}
        currencyView={currencyView}
        initialStatusFilter={statusFilter}
        onViewVoucher={(b) => {
          setHotelSelected(b);
          setHotelView('doc');
        }}
        onEditBooking={(b) => {
          setHotelEditing(b);
          setHotelView('form');
        }}
        onDuplicateBooking={(b) => {
          guarded('bookings.create', async () => {
            const copy: Booking = {
              ...b,
              id: `b-${Date.now()}`,
              bookingRef: generateInvoiceRef(),
              status: 'Unpaid',
              amountPaidSAR: 0,
              amountPaidIDR: 0,
              paymentHistory: [],
              vendorPayments: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await persistHotel(copy);
            flash(`Duplicated as ${copy.bookingRef}`);
          });
        }}
        onDeleteBooking={(id) => {
          guarded('bookings.delete', async () => {
            if (!window.confirm('Delete this booking permanently?')) return;
            await api(`/api/bookings/${id}`, { method: 'DELETE' });
            setBookings((prev) => prev.filter((x) => x.id !== id));
            flash('Booking deleted');
          });
        }}
        onMarkAsPaid={(id) => {
          guarded('bookings.pay', async () => {
            const current = bookings.find((x) => x.id === id);
            if (!current) return;
            const paid: Booking = {
              ...current,
              status: 'Paid',
              amountPaidSAR: current.totalSellSAR,
              amountPaidIDR: current.totalSellIDR,
              paymentHistory: [
                ...(current.paymentHistory || []),
                {
                  id: `pay-${Date.now()}`,
                  date: new Date().toISOString(),
                  amountSAR: Math.max(0, current.totalSellSAR - current.amountPaidSAR),
                  amountIDR: Math.max(0, current.totalSellIDR - current.amountPaidIDR),
                  exchangeRate: current.exchangeRate,
                  method: current.paymentMethod,
                  note: 'Marked as paid',
                },
              ],
            };
            await persistHotel(paid);
            flash('Marked as paid');
          });
        }}
        onNewBooking={() => {
          setHotelEditing(null);
          setActive('new-booking');
          setHotelView('form');
        }}
        onOpenImport={() => setHotelView('import')}
        onVisaAction={(id, action: VisaAction) => {
          guarded('bookings.update', async () => {
            const current = bookings.find((x) => x.id === id);
            if (!current) return;
            await persistHotel({ ...current, visaAction: action });
          });
        }}
      />
    );
  };

  const renderArmada = () => {
    if (armadaView === 'form') {
      return (
        <ArmadaBookingForm
          initialBooking={armadaEditing}
          settings={settings}
          customers={customers}
          onCancel={() => setArmadaView(armadaEditing ? 'list' : 'dash')}
          onSave={(b, openVoucher) => {
            guarded('bookings.update', async () => {
              const saved = await persistArmada(b);
              setArmadaEditing(null);
              flash(`Saved ${saved.armadaRef}`);
              if (openVoucher) {
                setArmadaSelected(saved);
                setArmadaView('doc');
              } else setArmadaView('list');
            });
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
          onEdit={() => {
            setArmadaEditing(armadaSelected);
            setArmadaView('form');
          }}
        />
      );
    }
    if (armadaView === 'list') {
      return (
        <ArmadaBookingList
          bookings={armada}
          settings={settings}
          currencyView={currencyView}
          onNew={() => {
            setArmadaEditing(null);
            setArmadaView('form');
          }}
          onViewVoucher={(b) => {
            setArmadaSelected(b);
            setArmadaView('doc');
          }}
          onEdit={(b) => {
            setArmadaEditing(b);
            setArmadaView('form');
          }}
          onDuplicate={(b) => {
            guarded('bookings.create', async () => {
              const copy: ArmadaBooking = {
                ...b,
                id: `amd-${Date.now()}`,
                armadaRef: generateArmadaRef(),
                status: 'Unpaid',
                amountPaidSAR: 0,
                amountPaidIDR: 0,
                paymentHistory: [],
              };
              await persistArmada(copy);
            });
          }}
          onDelete={(id) => {
            guarded('bookings.delete', async () => {
              if (!window.confirm('Delete this charter?')) return;
              await api(`/api/armada/${id}`, { method: 'DELETE' });
              setArmada((prev) => prev.filter((x) => x.id !== id));
            });
          }}
          onMarkAsPaid={(id) => {
            guarded('bookings.pay', async () => {
              const current = armada.find((x) => x.id === id);
              if (!current) return;
              await persistArmada({
                ...current,
                status: 'Paid',
                amountPaidSAR: current.totalSellSAR,
                amountPaidIDR: current.totalSellIDR,
                paymentHistory: [
                  ...current.paymentHistory,
                  {
                    id: `ap-${Date.now()}`,
                    date: new Date().toISOString(),
                    amountSAR: Math.max(0, current.totalSellSAR - current.amountPaidSAR),
                    amountIDR: Math.max(0, current.totalSellIDR - current.amountPaidIDR),
                    exchangeRate: current.exchangeRate,
                    method: current.paymentMethod,
                    note: 'Marked as paid',
                  },
                ],
              });
            });
          }}
          onExportExcel={(rows) => exportArmadaToExcel(rows)}
          onWhatsApp={(b) => shareArmadaViaWhatsApp(b, settings)}
        />
      );
    }
    return (
      <ArmadaDashboard
        bookings={armada}
        onNew={() => {
          setArmadaEditing(null);
          setArmadaView('form');
        }}
        onOpenList={() => setArmadaView('list')}
        onViewVoucher={(b) => {
          setArmadaSelected(b);
          setArmadaView('doc');
        }}
      />
    );
  };

  const renderTrain = () => {
    if (trainView === 'form') {
      return (
        <TrainBookingForm
          initialBooking={trainEditing}
          settings={settings}
          customers={customers}
          onCancel={() => setTrainView(trainEditing ? 'list' : 'dash')}
          onSave={(b, openTicket) => {
            guarded('bookings.update', async () => {
              const saved = await persistTrain(b);
              setTrainEditing(null);
              flash(`Saved ${saved.trainRef}`);
              if (openTicket) {
                setTrainSelected(saved);
                setTrainView('doc');
              } else setTrainView('list');
            });
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
          onEdit={() => {
            setTrainEditing(trainSelected);
            setTrainView('form');
          }}
        />
      );
    }
    if (trainView === 'list') {
      return (
        <TrainBookingList
          bookings={train}
          settings={settings}
          currencyView={currencyView}
          onNew={() => {
            setTrainEditing(null);
            setTrainView('form');
          }}
          onViewTicket={(b) => {
            setTrainSelected(b);
            setTrainView('doc');
          }}
          onEdit={(b) => {
            setTrainEditing(b);
            setTrainView('form');
          }}
          onDuplicate={(b) => {
            guarded('bookings.create', async () => {
              const copy: TrainBooking = {
                ...b,
                id: `tr-${Date.now()}`,
                trainRef: generateTrainRef(),
                status: 'Unpaid',
                amountPaidSAR: 0,
                amountPaidIDR: 0,
                paymentHistory: [],
              };
              await persistTrain(copy);
            });
          }}
          onDelete={(id) => {
            guarded('bookings.delete', async () => {
              if (!window.confirm('Delete this train booking?')) return;
              await api(`/api/train/${id}`, { method: 'DELETE' });
              setTrain((prev) => prev.filter((x) => x.id !== id));
            });
          }}
          onMarkAsPaid={(id) => {
            guarded('bookings.pay', async () => {
              const current = train.find((x) => x.id === id);
              if (!current) return;
              await persistTrain({
                ...current,
                status: 'Paid',
                amountPaidSAR: current.totalSellSAR,
                amountPaidIDR: current.totalSellIDR,
                paymentHistory: [
                  ...current.paymentHistory,
                  {
                    id: `tp-${Date.now()}`,
                    date: new Date().toISOString(),
                    amountSAR: Math.max(0, current.totalSellSAR - current.amountPaidSAR),
                    amountIDR: Math.max(0, current.totalSellIDR - current.amountPaidIDR),
                    exchangeRate: current.exchangeRate,
                    method: current.paymentMethod,
                    note: 'Marked as paid',
                  },
                ],
              });
            });
          }}
          onExportExcel={(rows) => exportTrainToExcel(rows)}
          onWhatsApp={(b) => shareTrainViaWhatsApp(b, settings)}
        />
      );
    }
    return (
      <TrainDashboard
        bookings={train}
        onNew={() => {
          setTrainEditing(null);
          setTrainView('form');
        }}
        onOpenList={() => setTrainView('list')}
        onViewTicket={(b) => {
          setTrainSelected(b);
          setTrainView('doc');
        }}
      />
    );
  };

  const renderContent = () => {
    switch (active) {
      case 'armada':
        return renderArmada();
      case 'train':
        return renderTrain();
      case 'dashboard':
        return (
          <Dashboard
            bookings={bookings}
            settings={settings}
            currencyView={currencyView}
            onNewBooking={() => go('new-booking')}
            onViewBookings={(filter) => {
              setStatusFilter(filter || 'ALL');
              go('bookings');
            }}
            onViewVoucher={(b) => {
              setHotelSelected(b);
              setHotelView('doc');
              setActive('bookings');
            }}
            onMarkAsPaid={(id) => {
              const current = bookings.find((x) => x.id === id);
              if (!current) return;
              void persistHotel({
                ...current,
                status: 'Paid',
                amountPaidSAR: current.totalSellSAR,
                amountPaidIDR: current.totalSellIDR,
              });
            }}
            onOpenCalendar={() => go('calendar')}
          />
        );
      case 'bookings':
      case 'new-booking':
        return renderHotel();
      case 'reports':
        return (
          <Reports
            bookings={bookings}
            settings={settings}
            onViewVoucher={(b) => {
              setHotelSelected(b);
              setHotelView('doc');
              setActive('bookings');
            }}
          />
        );
      case 'calendar':
        return (
          <BookingCalendar
            bookings={bookings}
            settings={settings}
            onViewVoucher={(b) => {
              setHotelSelected(b);
              setHotelView('doc');
              setActive('bookings');
            }}
          />
        );
      case 'management':
        return (
          <DirectoryManagement
            vendors={vendors}
            products={products}
            clients={customers}
            bookings={bookings}
            onVendorsChange={(records) => {
              setVendors(records);
              void api('/api/masters', { method: 'PUT', body: JSON.stringify({ vendors: records }) });
            }}
            onProductsChange={(records) => {
              setProducts(records);
              void api('/api/masters', { method: 'PUT', body: JSON.stringify({ products: records }) });
            }}
            onClientsChange={(records) => {
              setCustomers(records);
              void api('/api/masters', { method: 'PUT', body: JSON.stringify({ customers: records }) });
            }}
          />
        );
      case 'users':
        return can('users.read') ? <UsersPanel currentUserId={user.id} /> : <p className="text-sm text-rose-600">Forbidden</p>;
      case 'audit':
        return can('audit.read') ? <AuditPanel /> : <p className="text-sm text-rose-600">Forbidden</p>;
      case 'settings':
        return (
          <div className="bg-white dark:bg-slate-900 border rounded-2xl p-8 text-center">
            <h2 className="font-black text-lg">Company settings</h2>
            <p className="text-sm text-slate-500 mt-2">Use the Settings &amp; FX button in the header, or open users / audit from admin tools.</p>
            <button onClick={() => setSettingsOpen(true)} className="mt-4 bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-sm">
              Open settings
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-400/30 animate-pulse" />
          <p className="text-sm text-slate-300">{loadError || 'Loading TAMIMA workspace…'}</p>
          {loadError && (
            <button onClick={() => void load()} className="text-xs font-bold bg-emerald-600 px-3 py-2 rounded-lg">
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header
        activeTab={active === 'users' || active === 'audit' ? 'settings' : active}
        setActiveTab={(tab) => go(tab)}
        settings={settings}
        liveRate={liveRate}
        openSettings={() => setSettingsOpen(true)}
        currencyView={currencyView}
        setCurrencyView={setCurrencyView}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        user={user}
        onLogout={async () => {
          await api('/api/auth/logout', { method: 'POST' });
          window.location.href = '/login';
        }}
        onOpenUsers={can('users.read') ? () => go('users') : undefined}
        onOpenAudit={can('audit.read') ? () => go('audit') : undefined}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{renderContent()}</main>
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          bookings={bookings}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onSaveSettings={(next) => {
            setSettings(next);
            void api('/api/settings', { method: 'PUT', body: JSON.stringify(next) }).then(() => flash('Settings saved'));
          }}
          onRestoreBookings={() => {
            flash('Restore from backup is handled via Excel import');
          }}
          onResetData={() => flash('Reset is disabled in the live workspace')}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[60] bg-slate-900 text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
