import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  BedDouble,
  X,
  FileText,
  Users,
  MoonStar,
  TrendingUp,
} from 'lucide-react';
import { Booking, CompanySettings, PaymentStatus } from '../types/booking';
import { formatSAR } from '../utils/currency';

interface BookingCalendarProps {
  bookings: Booking[];
  settings: CompanySettings;
  onViewVoucher: (b: Booking) => void;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* Colorful per-booking stay palette — each reservation gets its own hue across the month */
const STAY_PALETTE = [
  'bg-emerald-500 border-emerald-700 text-white',
  'bg-sky-500 border-sky-700 text-white',
  'bg-amber-400 border-amber-600 text-amber-950',
  'bg-rose-500 border-rose-700 text-white',
  'bg-violet-500 border-violet-700 text-white',
  'bg-cyan-500 border-cyan-700 text-white',
  'bg-orange-500 border-orange-700 text-white',
  'bg-fuchsia-500 border-fuchsia-700 text-white',
  'bg-lime-500 border-lime-700 text-lime-950',
  'bg-indigo-500 border-indigo-700 text-white',
  'bg-teal-500 border-teal-700 text-white',
  'bg-pink-500 border-pink-700 text-white',
];
const isoPlusOne = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const badgeStyle: Record<PaymentStatus, string> = {
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  Partial: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
  Unpaid: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300',
  Draft: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  Cancelled: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-800 dark:text-slate-400',
};

export const BookingCalendar: React.FC<BookingCalendarProps> = ({ bookings, onViewVoucher }) => {
  const todayISO = toISO(new Date());
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Stable colorful assignment per booking
  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    bookings.forEach((b, i) => m.set(b.id, STAY_PALETTE[i % STAY_PALETTE.length]));
    return m;
  }, [bookings]);

  // Build 6x7 grid (Monday-start)
  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(cursor.year, cursor.month, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === cursor.month };
    });
  }, [cursor]);

  const activeBookings = useMemo(() => bookings.filter((b) => b.status !== 'Cancelled'), [bookings]);

  const isActive = (b: Booking, iso: string) => b.checkInDate <= iso && iso < b.checkOutDate;
  const isArrival = (b: Booking, iso: string) => b.checkInDate === iso;
  const isDeparture = (b: Booking, iso: string) => b.checkOutDate === iso;

  // Month-level stats
  const monthStats = useMemo(() => {
    const prefix = `${cursor.year}-${pad(cursor.month + 1)}`;
    const inMonth = (iso: string) => iso.startsWith(prefix);
    const arrivals = activeBookings.filter((b) => inMonth(b.checkInDate)).length;
    const departures = activeBookings.filter((b) => inMonth(b.checkOutDate)).length;
    let peak = 0;
    cells.forEach((c) => {
      if (c.inMonth) peak = Math.max(peak, activeBookings.filter((b) => isActive(b, c.iso)).length);
    });
    const roomNights = activeBookings
      .filter((b) => inMonth(b.checkInDate) || inMonth(b.checkOutDate))
      .reduce((s, b) => s + b.totalNights, 0);
    return { arrivals, departures, peak, roomNights };
  }, [activeBookings, cells, cursor]);

  // Today's operations
  const todayOps = useMemo(() => {
    const arr = activeBookings.filter((b) => isArrival(b, todayISO));
    const dep = activeBookings.filter((b) => isDeparture(b, todayISO));
    const house = activeBookings.filter((b) => isActive(b, todayISO));
    return { arr, dep, house };
  }, [activeBookings, todayISO]);

  const selected = selectedDay
    ? {
        arrivals: activeBookings.filter((b) => isArrival(b, selectedDay)),
        departures: activeBookings.filter((b) => isDeparture(b, selectedDay)),
        inHouse: activeBookings.filter((b) => isActive(b, selectedDay)),
      }
    : null;

  const move = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const BookingItem: React.FC<{ b: Booking; tag?: 'IN' | 'OUT' }> = ({ b, tag }) => (
    <div className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:border-emerald-400 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] font-black text-orange-600">{b.bookingRef}</span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${badgeStyle[b.status]}`}>
              {b.status.toUpperCase()}
            </span>
            {tag && (
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${
                  tag === 'IN' ? 'bg-emerald-600' : 'bg-sky-600'
                }`}
              >
                {tag === 'IN' ? 'CHECK-IN' : 'CHECK-OUT'}
              </span>
            )}
          </div>
          <p className="font-bold text-sm text-slate-900 dark:text-white truncate mt-0.5">{b.customerName}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {b.hotelName} · {b.totalNights}N · {b.groupSize.adults + b.groupSize.children} pax
          </p>
        </div>
        <button
          onClick={() => onViewVoucher(b)}
          className="flex-shrink-0 p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg opacity-70 group-hover:opacity-100 hover:bg-emerald-600 hover:text-white transition-all"
          title="Open Confirmation Letter"
        >
          <FileText className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between text-[10px]">
        <span className="text-slate-500">
          {b.checkInDate} → {b.checkOutDate}
        </span>
        <span className={`font-bold ${b.totalSellSAR - b.amountPaidSAR > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {b.totalSellSAR - b.amountPaidSAR > 0 ? `Bal: ${formatSAR(b.totalSellSAR - b.amountPaidSAR)}` : 'Lunas'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-16">
      {/* ===== Header ===== */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-600/30">
              <CalendarDays className="w-5 h-5" />
            </span>
            Booking Schedule Calendar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visual check-in & check-out timeline generated from live booking data
          </p>
        </div>

        {/* Today operations pulse */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs">
            <LogIn className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-black text-emerald-800 dark:text-emerald-300">{todayOps.arr.length}</span>
            <span className="text-emerald-700 dark:text-emerald-400">Arrivals</span>
          </div>
          <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 rounded-xl px-3 py-2 text-xs">
            <LogOut className="w-3.5 h-3.5 text-sky-600" />
            <span className="font-black text-sky-800 dark:text-sky-300">{todayOps.dep.length}</span>
            <span className="text-sky-700 dark:text-sky-400">Departures</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs">
            <MoonStar className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-black text-slate-800 dark:text-slate-200">{todayOps.house.length}</span>
            <span className="text-slate-600 dark:text-slate-300">In-House</span>
          </div>
        </div>
      </div>

      {/* ===== Month nav + stats ===== */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-emerald-50/40 dark:from-slate-900 dark:to-emerald-950/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => move(-1)}
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-emerald-600 transition-all active:scale-90"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-[170px] text-center">
              <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none">
                {MONTHS[cursor.month]} <span className="text-emerald-600">{cursor.year}</span>
              </h3>
            </div>
            <button
              onClick={() => move(1)}
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-emerald-600 transition-all active:scale-90"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const n = new Date();
                setCursor({ year: n.getFullYear(), month: n.getMonth() });
                setSelectedDay(todayISO);
              }}
              className="ml-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg transition-colors"
            >
              Hari Ini
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Arrivals', value: monthStats.arrivals, icon: LogIn, cls: 'text-emerald-600' },
              { label: 'Departures', value: monthStats.departures, icon: LogOut, cls: 'text-sky-600' },
              { label: 'Peak In-House', value: monthStats.peak, icon: BedDouble, cls: 'text-indigo-500' },
              { label: 'Room-Nights', value: monthStats.roomNights, icon: TrendingUp, cls: 'text-orange-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
                <p className={`text-base font-black leading-none ${s.cls}`}>{s.value}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Grid ===== */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr">
          {cells.map((c, i) => {
            const dayBookings = activeBookings.filter((b) => isActive(b, c.iso));
            const arrivals = activeBookings.filter((b) => isArrival(b, c.iso));
            const departures = activeBookings.filter((b) => isDeparture(b, c.iso));
            const isToday = c.iso === todayISO;
            const visible = dayBookings.slice(0, 3);
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(c.iso)}
                className={`relative min-h-[62px] sm:min-h-[96px] p-1 sm:p-1.5 text-left border-b border-r border-slate-100 dark:border-slate-800 transition-colors group/cell
                  ${c.inMonth ? 'bg-white dark:bg-slate-900 hover:bg-emerald-50/60 dark:hover:bg-slate-800' : 'bg-slate-50/70 dark:bg-slate-950/60 text-slate-300 dark:text-slate-600'}
                  ${selectedDay === c.iso ? 'ring-2 ring-inset ring-emerald-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold
                      ${isToday ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/40 animate-pulse' : c.inMonth ? 'text-slate-700 dark:text-slate-200' : ''}`}
                    title={
                      arrivals.length > 0
                        ? `Marked Date · Check-In: ${arrivals.map((b) => b.customerName).join(', ')}`
                        : departures.length > 0
                          ? `Marked Date · Check-Out: ${departures.map((b) => b.customerName).join(', ')}`
                          : undefined
                    }
                  >
                    {c.day}
                  </span>
                  {/* Tidy marked-date dots: emerald = IN, rose = OUT (count when >1) */}
                  {(arrivals.length > 0 || departures.length > 0) && (
                    <span className="flex items-center gap-1">
                      {arrivals.length > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900" />
                          {arrivals.length > 1 && <span className="text-[8px] font-black">×{arrivals.length}</span>}
                        </span>
                      )}
                      {departures.length > 0 && (
                        <span className="flex items-center gap-0.5 text-rose-600">
                          <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-900" />
                          {departures.length > 1 && <span className="text-[8px] font-black">×{departures.length}</span>}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <div className="mt-1 space-y-0.5">
                  {visible.map((b) => {
                    const start = b.checkInDate === c.iso;
                    const lastNight = isoPlusOne(c.iso) === b.checkOutDate;
                    const hue = colorMap.get(b.id) || STAY_PALETTE[0];
                    return (
                      <div
                        key={b.id}
                        title={`${b.customerName} · ${b.hotelName} · IN ${b.checkInDate} → OUT ${b.checkOutDate} (${b.totalNights} malam)`}
                        className={`flex items-center h-[15px] text-[7px] sm:text-[8.5px] font-bold px-1 rounded border transition-all hover:scale-[1.03] hover:shadow-md ${hue} ${
                          start ? 'rounded-l-none border-l-[3px]' : ''
                        } ${lastNight ? 'rounded-r-none border-r-[3px]' : ''}`}
                      >
                        {/* Guest name + in-house duration, shown once on the check-in night */}
                        {start && (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <span className="bg-white/25 rounded px-0.5 text-[6px] font-black tracking-wider">IN</span>
                            <span className="truncate">{b.customerName.split(' ')[0]}</span>
                            <span className="opacity-80 font-black">{b.totalNights}H</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {dayBookings.length > 3 && (
                    <span className="text-[8.5px] font-bold text-emerald-700 dark:text-emerald-400 px-1">
                      +{dayBookings.length - 3} lagi
                    </span>
                  )}
                </div>

                {/* ===== OUT marker on the actual check-out date — aligned end-cap, same lane as bars ===== */}
                {departures.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {departures.slice(0, 3).map((b) => {
                      const hue = colorMap.get(b.id) || STAY_PALETTE[0];
                      return (
                        <div
                          key={`out-${b.id}`}
                          title={`${b.customerName} · Check-Out ${b.checkOutDate} · menginap ${b.totalNights} hari`}
                          className={`flex items-center justify-end h-[15px] text-[7px] sm:text-[8.5px] font-black px-1 rounded rounded-r-none border-r-[3px] transition-all hover:scale-[1.03] hover:shadow-md ${hue}`}
                        >
                          <span className="bg-white/25 rounded px-0.5 text-[6px] font-black tracking-wider">OUT</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          <span className="uppercase tracking-wider text-slate-400 font-black">Masa Inap:</span>
          {STAY_PALETTE.slice(0, 6).map((p, i) => (
            <span key={i} className={`w-4 h-2.5 rounded-sm border ${p}`} />
          ))}
          <span className="text-slate-400">= warna unik per booking</span>
          <span className="flex items-center gap-1">
            <span className="font-black text-emerald-700">IN▸</span> hari check-in
          </span>
          <span className="flex items-center gap-1">
            <span className="font-black text-rose-600">▸OUT</span> malam terakhir (check-out esok)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" /> tanggal check-in
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-200" /> tanggal check-out
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-white/40 border border-slate-300 rounded px-0.5 text-[7px] font-black">IN</span>
            <span className="bg-white/40 border border-slate-300 rounded px-0.5 text-[7px] font-black">OUT</span>
            penanda di batang inap · "5H" = lama in-house
          </span>
          <span className="flex items-center gap-1 ml-auto text-emerald-700">
            <Users className="w-3 h-3" /> Klik tanggal untuk detail arrivals / departures / in-house
          </span>
        </div>
      </div>

      {/* ===== Day Detail Drawer ===== */}
      {selectedDay && selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedDay(null)} />
          <div className="relative w-full max-w-md h-full bg-slate-100 dark:bg-slate-950 shadow-2xl overflow-y-auto animate-[slideIn_.25s_ease-out]">
            <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
            <div className="sticky top-0 bg-slate-900 text-white px-5 py-4 flex items-center justify-between z-10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Daily Operations</p>
                <h3 className="text-lg font-black">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              <section>
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
                  <LogIn className="w-4 h-4" /> Arrivals / Check-In ({selected.arrivals.length})
                </h4>
                <div className="space-y-2">
                  {selected.arrivals.length === 0 && (
                    <p className="text-[11px] italic text-slate-400">Tidak ada check-in pada tanggal ini.</p>
                  )}
                  {selected.arrivals.map((b) => (
                    <BookingItem key={b.id} b={b} tag="IN" />
                  ))}
                </div>
              </section>

              <section>
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-sky-700 dark:text-sky-400 mb-2">
                  <LogOut className="w-4 h-4" /> Departures / Check-Out ({selected.departures.length})
                </h4>
                <div className="space-y-2">
                  {selected.departures.length === 0 && (
                    <p className="text-[11px] italic text-slate-400">Tidak ada check-out pada tanggal ini.</p>
                  )}
                  {selected.departures.map((b) => (
                    <BookingItem key={b.id} b={b} tag="OUT" />
                  ))}
                </div>
              </section>

              <section>
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                  <MoonStar className="w-4 h-4" /> In-House Tonight ({selected.inHouse.length})
                </h4>
                <div className="space-y-2">
                  {selected.inHouse.length === 0 && (
                    <p className="text-[11px] italic text-slate-400">Tidak ada tamu menginap malam ini.</p>
                  )}
                  {selected.inHouse.map((b) => (
                    <BookingItem key={b.id} b={b} />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
