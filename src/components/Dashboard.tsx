import React, { useEffect, useMemo, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  FileSpreadsheet, 
  Hotel, 
  Calendar, 
  ArrowUpRight, 
  Sparkles,
  PieChart,
  ShieldCheck,
  BellRing,
  LogIn,
  LogOut,
  Wallet,
  FileText,
  ShieldAlert,
  ChevronDown,
  CalendarDays,
  MoonStar,
  BedDouble
} from 'lucide-react';
import { Booking, CompanySettings, VisaAction } from '../types/booking';
import { formatSAR, formatIDR } from '../utils/currency';
import { exportBookingsToExcel } from '../utils/export';
import { daysUntil, VISA_ACTIONS, visaActionStyle } from '../utils/visa';
import { RiyalIcon } from './RiyalIcon';

interface TodayItem {
  id: string;
  kind: 'checkin' | 'checkout' | 'visa' | 'payment';
  severity: 0 | 1 | 2 | 3; // 0 info … 3 critical
  title: string;
  sub: string;
  booking: Booking;
  alarm?: string;
}

interface DashboardProps {
  bookings: Booking[];
  settings?: CompanySettings;
  currencyView: 'DUAL' | 'SAR' | 'IDR';
  onNewBooking: () => void;
  onViewBookings: (filter?: string) => void;
  onViewVoucher: (booking: Booking) => void;
  onMarkAsPaid?: (id: string) => void;
  onVisaAction?: (id: string, action: VisaAction) => void;
  onOpenCalendar?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  bookings,
  currencyView,
  onNewBooking,
  onViewBookings,
  onViewVoucher,
  onMarkAsPaid,
  onVisaAction,
  onOpenCalendar,
}) => {
  // Live clock for the operations strip
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const [todayFilter, setTodayFilter] = useState<'all' | TodayItem['kind']>('all');
  const [notifOpen, setNotifOpen] = useState(false);
  // Aggregate KPIs
  const totalBookings = bookings.length;
  
  const totalRevenueSAR = bookings.reduce((sum, b) => sum + b.totalSellSAR, 0);
  const totalRevenueIDR = bookings.reduce((sum, b) => sum + b.totalSellIDR, 0);

  const totalCostSAR = bookings.reduce((sum, b) => sum + b.totalCostSAR, 0);
  const totalCostIDR = bookings.reduce((sum, b) => sum + b.totalCostIDR, 0);

  const totalProfitSAR = bookings.reduce((sum, b) => sum + b.profitSAR, 0);
  const totalProfitIDR = bookings.reduce((sum, b) => sum + b.profitIDR, 0);

  const avgMargin = totalRevenueSAR > 0 ? (totalProfitSAR / totalRevenueSAR) * 100 : 0;

  const totalPaidSAR = bookings.reduce((sum, b) => sum + b.amountPaidSAR, 0);
  const totalPaidIDR = bookings.reduce((sum, b) => sum + b.amountPaidIDR, 0);

  const unpaidBalanceSAR = totalRevenueSAR - totalPaidSAR;
  const unpaidBalanceIDR = totalRevenueIDR - totalPaidIDR;

  // Counts by status
  const paidCount = bookings.filter((b) => b.status === 'Paid').length;
  const partialCount = bookings.filter((b) => b.status === 'Partial').length;
  const unpaidCount = bookings.filter((b) => b.status === 'Unpaid').length;
  const draftCount = bookings.filter((b) => b.status === 'Draft').length;

  // Unpaid bookings array for quick action panel
  const unpaidBookings = bookings.filter((b) => b.status === 'Unpaid' || b.status === 'Partial');

  // ===== Today's actionable items (date-driven warnings) =====
  const todayItems = useMemo<TodayItem[]>(() => {
    const items: TodayItem[] = [];
    bookings.forEach((b) => {
      if (b.status === 'Cancelled') return;
      const dIn = daysUntil(b.checkInDate);
      const dOut = daysUntil(b.checkOutDate);
      const balance = b.totalSellSAR - b.amountPaidSAR;
      if (dIn === 0)
        items.push({
          id: `ci-${b.id}`,
          kind: 'checkin',
          severity: 2,
          title: 'Check-in hari ini',
          sub: `${b.hotelName} · ${b.totalNights} malam · ${b.customerName}`,
          booking: b,
        });
      if (dOut === 0)
        items.push({
          id: `co-${b.id}`,
          kind: 'checkout',
          severity: 1,
          title: 'Check-out hari ini',
          sub: `${b.hotelName} · ${b.customerName} · sisa ${formatSAR(balance)}`,
          booking: b,
        });
      if (dIn >= 0 && dIn <= 30 && !['Approved', 'Rejected', 'BRN'].includes(b.visaAction || '')) {
        items.push({
          id: `vi-${b.id}`,
          kind: 'visa',
          severity: (dIn <= 7 ? 3 : dIn <= 15 ? 2 : 1) as 0 | 1 | 2 | 3,
          title: dIn === 0 ? 'Visa — check-in HARI INI!' : `Approval visa H-${dIn} — kejar sekarang`,
          sub: `${b.customerName} · ${b.hotelName} · ${b.checkInDate}`,
          booking: b,
          alarm: dIn <= 7 ? 'alarm-fast' : dIn <= 15 ? 'alarm-mid' : 'alarm-slow',
        });
      }
      if (b.dueDate && balance > 0.5 && b.status !== 'Paid' && daysUntil(b.dueDate) <= 0) {
        const od = -daysUntil(b.dueDate);
        items.push({
          id: `py-${b.id}`,
          kind: 'payment',
          severity: (od >= 3 ? 3 : 2) as 0 | 1 | 2 | 3,
          title: od > 0 ? `Tagihan terlambat ${od} hari` : 'Tagihan jatuh tempo hari ini',
          sub: `${b.customerName} · sisa ${formatSAR(balance)} (${formatIDR(b.totalSellIDR - b.amountPaidIDR)})`,
          booking: b,
          alarm: od >= 3 ? 'alarm-fast' : 'alarm-mid',
        });
      }
    });
    return items.sort((a, z) => z.severity - a.severity);
  }, [bookings]);

  const kindMeta = {
    checkin: { label: 'Check-In', icon: LogIn, dot: 'bg-emerald-500', ring: 'border-emerald-500' },
    checkout: { label: 'Check-Out', icon: LogOut, dot: 'bg-sky-500', ring: 'border-sky-500' },
    visa: { label: 'Visa', icon: ShieldAlert, dot: 'bg-orange-500', ring: 'border-orange-500' },
    payment: { label: 'Tagihan', icon: Wallet, dot: 'bg-rose-500', ring: 'border-rose-500' },
  } as const;

  const counts = {
    checkin: todayItems.filter((i) => i.kind === 'checkin').length,
    checkout: todayItems.filter((i) => i.kind === 'checkout').length,
    visa: todayItems.filter((i) => i.kind === 'visa').length,
    payment: todayItems.filter((i) => i.kind === 'payment').length,
  };
  const criticalCount = todayItems.filter((i) => i.severity >= 3).length;
  const filteredToday = todayFilter === 'all' ? todayItems : todayItems.filter((i) => i.kind === todayFilter);

  // ===== Today's calendar recap =====
  const isoOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayISO = isoOf(now);
  const isLive = (b: Booking) => b.status !== 'Cancelled';
  const arrivalsToday = bookings.filter((b) => isLive(b) && b.checkInDate === todayISO);
  const departuresToday = bookings.filter((b) => isLive(b) && b.checkOutDate === todayISO);
  const inHouseToday = bookings.filter((b) => isLive(b) && b.checkInDate <= todayISO && todayISO < b.checkOutDate);
  const roomsTonight = inHouseToday.reduce((s, b) => s + b.rooms.reduce((r, x) => r + x.numberOfRooms, 0), 0);
  const activeMap = new Map<string, Booking>();
  [...arrivalsToday, ...departuresToday, ...inHouseToday].forEach((b) => activeMap.set(b.id, b));
  const activeToday = Array.from(activeMap.values());
  const statusRecap = (['Paid', 'Partial', 'Unpaid', 'Draft'] as const).map((k) => ({
    key: k,
    label: k === 'Paid' ? 'Lunas' : k === 'Partial' ? 'Partial' : k === 'Unpaid' ? 'Belum Bayar' : 'Draft',
    n: activeToday.filter((b) => b.status === k).length,
    bar: k === 'Paid' ? 'bg-emerald-500' : k === 'Partial' ? 'bg-amber-400' : k === 'Unpaid' ? 'bg-rose-500' : 'bg-slate-400',
    txt: k === 'Paid' ? 'text-emerald-600' : k === 'Partial' ? 'text-amber-600' : k === 'Unpaid' ? 'text-rose-600' : 'text-slate-500',
  }));
  const collectPotential = departuresToday.reduce((s, b) => s + (b.totalSellSAR - b.amountPaidSAR), 0);
  const incomingValue = arrivalsToday.reduce((s, b) => s + b.totalSellSAR, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const iso = isoOf(d);
    return {
      label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
      day: d.getDate(),
      arr: bookings.filter((b) => isLive(b) && b.checkInDate === iso).length,
      dep: bookings.filter((b) => isLive(b) && b.checkOutDate === iso).length,
      house: bookings.filter((b) => isLive(b) && b.checkInDate <= iso && iso < b.checkOutDate).length,
      isToday: i === 0,
    };
  });
  const weekMax = Math.max(1, ...week.map((w) => w.house));

  // Top hotels by booking count
  const hotelCounts: Record<string, { count: number; profitSAR: number }> = {};
  bookings.forEach((b) => {
    if (!hotelCounts[b.hotelName]) {
      hotelCounts[b.hotelName] = { count: 0, profitSAR: 0 };
    }
    hotelCounts[b.hotelName].count += 1;
    hotelCounts[b.hotelName].profitSAR += b.profitSAR;
  });

  const topHotels = Object.entries(hotelCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 4);

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome & Quick Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-10">
          <Sparkles className="w-64 h-64 text-emerald-400" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>TAMIMA Small Business Operations Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Hospitality Profitability Dashboard
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Real-time booking profitability metrics, currency conversions (SAR & IDR), customer vouchers, and payment balance tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onNewBooking}
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-900/30 transition-all text-sm"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Booking</span>
            </button>

            <button
              onClick={() => exportBookingsToExcel(bookings)}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3.5 py-2.5 rounded-xl transition-all text-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== NOTIFICATION BELL — blinking logo + total count ===== */}
      <div className="relative">
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all hover:shadow-xl hover:-translate-y-px active:translate-y-0 ${
            criticalCount > 0
              ? 'bg-gradient-to-r from-rose-950/80 to-slate-900 border-rose-800/80 hover:border-rose-600'
              : todayItems.length > 0
                ? 'bg-gradient-to-r from-amber-950/70 to-slate-900 border-amber-800/80 hover:border-amber-600'
                : 'bg-gradient-to-r from-emerald-950/70 to-slate-900 border-emerald-800/80 hover:border-emerald-600'
          }`}
          aria-expanded={notifOpen}
        >
          {/* Blinking bell logo with total count badge */}
          <span
            className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${
              criticalCount > 0
                ? 'bg-rose-600 alarm-fast'
                : todayItems.length > 0
                  ? 'bg-amber-500 alarm-slow'
                  : 'bg-emerald-600'
            }`}
          >
            {todayItems.length > 0 ? <BellRing className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            {todayItems.length > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-slate-900 border-2 border-slate-900 shadow alarm-mid">
                {todayItems.length}
              </span>
            )}
          </span>

          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-[11px] font-black tracking-[0.18em] text-white flex items-center gap-1.5">
              {todayItems.length > 0 ? 'ACTION REQUIRED' : 'ALL CLEAR'}
              {criticalCount > 0 && (
                <span className="text-[8px] font-black bg-rose-600 text-white px-1.5 py-px rounded-full alarm-fast tracking-normal">
                  {criticalCount} KRITIS
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-300/90 mt-0.5 truncate">
              {todayItems.length > 0
                ? `${todayItems.length} notifikasi menunggu tindak lanjut hari ini — ketuk untuk detail`
                : 'Tidak ada aksi mendesak untuk hari ini'}
            </p>
          </div>

          <ChevronDown className={`w-4 h-4 flex-shrink-0 text-slate-300 transition-transform duration-200 ${notifOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Expandable notification panel */}
        {notifOpen && (
          <div className="mt-2 rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-700 overflow-hidden animate-[notifIn_.18s_ease-out]">
            <style>{`@keyframes notifIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

            {/* Panel header: live clock + filter chips */}
            <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-slate-950/60">
              <p className="text-[9px] font-mono text-slate-400 mr-auto">
                {now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}
                {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <button
                onClick={() => setTodayFilter('all')}
                className={`px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all ${
                  todayFilter === 'all' ? 'bg-white text-slate-900 border-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                Semua {todayItems.length}
              </button>
              {(Object.keys(kindMeta) as (keyof typeof kindMeta)[]).map((k) => {
                const M = kindMeta[k];
                return (
                  <button
                    key={k}
                    onClick={() => setTodayFilter(todayFilter === k ? 'all' : k)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all ${
                      todayFilter === k ? 'bg-white text-slate-900 border-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${M.dot} ${counts[k] > 0 && (k === 'visa' || k === 'payment') ? 'alarm-mid' : ''}`} />
                    {M.label} {counts[k]}
                  </button>
                );
              })}
            </div>

            {/* Scrollable item list */}
            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {filteredToday.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-2.5 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-emerald-300">
                    {todayItems.length === 0 ? 'Semua terkendali — tidak ada aksi mendesak hari ini.' : 'Tidak ada item pada kategori ini.'}
                  </p>
                </div>
              ) : (
                filteredToday.map((it) => {
                  const M = kindMeta[it.kind];
                  const borderCls =
                    it.severity >= 3 ? 'border-l-rose-500' : it.severity === 2 ? 'border-l-orange-500' : it.severity === 1 ? 'border-l-amber-400' : 'border-l-emerald-500';
                  return (
                    <div
                      key={it.id}
                      className={`group flex items-center gap-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/50 border-l-2 ${borderCls} px-2 py-1.5 transition-all hover:translate-x-0.5`}
                    >
                      <M.icon className={`w-3.5 h-3.5 flex-shrink-0 ${it.alarm ? 'text-rose-400' : 'text-slate-300'}`} />
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="text-[10px] font-black truncate flex items-center gap-1.5">
                          {it.alarm && <span className={`inline-block w-1.5 h-1.5 flex-shrink-0 rounded-full bg-rose-500 ${it.alarm}`} />}
                          {it.title}
                        </p>
                        <p className="text-[8.5px] text-slate-400 truncate">
                          <span className="font-mono text-orange-400">{it.booking.bookingRef}</span> · {it.sub}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {it.kind === 'visa' && onVisaAction && (
                          <select
                            value={it.booking.visaAction || ''}
                            onChange={(e) => onVisaAction(it.booking.id, e.target.value as VisaAction)}
                            className={`px-1.5 py-0.5 rounded-md border text-[8.5px] font-black cursor-pointer ${
                              it.booking.visaAction ? visaActionStyle[it.booking.visaAction] : 'bg-slate-900 text-slate-300 border-slate-600'
                            }`}
                          >
                            <option value="">— Action —</option>
                            {VISA_ACTIONS.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        )}
                        {it.kind === 'payment' && onMarkAsPaid && it.booking.status !== 'Paid' && (
                          <button
                            onClick={() => onMarkAsPaid(it.booking.id)}
                            className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[8.5px] font-black transition-colors"
                          >
                            Paid
                          </button>
                        )}
                        <button
                          onClick={() => onViewVoucher(it.booking)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-[8.5px] font-bold transition-colors"
                        >
                          <FileText className="w-2.5 h-2.5" /> Voucher
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Panel footer */}
            <button
              onClick={() => {
                setNotifOpen(false);
                onViewBookings();
              }}
              className="w-full text-center text-[9px] font-black tracking-wider text-slate-400 hover:text-orange-400 hover:bg-slate-800/60 py-1.5 border-t border-slate-800 transition-colors"
            >
              BUKA BOOKINGS UNTUK SEMUA DATA →
            </button>
          </div>
        )}
      </div>

      {/* ===== TODAY'S CALENDAR RECAP ===== */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <h3 className="text-[11px] font-black tracking-[0.18em] text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            REKAP OPERASIONAL HARI INI
          </h3>
          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              className="flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              BUKA KALENDER <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-12">
          {/* Big live date */}
          <div className="col-span-2 lg:col-span-3 bg-slate-900 text-white p-4 flex flex-col justify-between gap-3 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-8 opacity-[0.07] pointer-events-none">
              <CalendarDays className="w-36 h-36 text-emerald-400" />
            </div>
            <div className="flex items-center justify-between relative">
              <span className="flex items-center gap-1.5 text-[8px] font-black tracking-[0.22em] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
              </span>
              <span className="font-mono text-[10px] text-emerald-300">
                {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <div className="relative">
              <p className="text-4xl sm:text-5xl font-black leading-none tracking-tight">{now.getDate()}</p>
              <p className="text-sm font-bold text-slate-100 capitalize mt-1">
                {now.toLocaleDateString('id-ID', { weekday: 'long' })}
              </p>
              <p className="text-[10px] text-slate-400">
                {now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Operational stat tiles */}
          <div className="col-span-2 lg:col-span-3 grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 lg:border-x border-slate-100 dark:border-slate-800">
            {[
              { icon: LogIn, label: 'Check-In', n: arrivalsToday.length, cls: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
              { icon: LogOut, label: 'Check-Out', n: departuresToday.length, cls: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/40' },
              { icon: MoonStar, label: 'In-House', n: inHouseToday.length, cls: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
              { icon: BedDouble, label: 'Room-Night', n: roomsTonight, cls: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40' },
            ].map((s) => (
              <div key={s.label} className="p-3 sm:p-3.5 bg-white dark:bg-slate-900 flex flex-col justify-between gap-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 group">
                <span className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center ${s.cls} group-hover:scale-110 transition-transform`}>
                  <s.icon className="w-3.5 h-3.5" />
                </span>
                <div>
                  <p className={`text-2xl font-black leading-none ${s.cls}`}>{s.n}</p>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status breakdown of today's active bookings */}
          <div className="lg:col-span-3 p-3.5 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
              Status Booking Aktif ({activeToday.length})
            </p>
            <div className="space-y-2">
              {statusRecap.map((s) => {
                const pct = activeToday.length > 0 ? (s.n / activeToday.length) * 100 : 0;
                return (
                  <div key={s.key}>
                    <div className="flex justify-between text-[9px] font-bold mb-0.5">
                      <span className={s.txt}>{s.label}</span>
                      <span className="text-slate-600 dark:text-slate-300">{s.n}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.bar} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <p className="flex justify-between text-[9px] font-bold">
                <span className="text-slate-400">Potensi Tagihan Check-Out</span>
                <span className={`flex items-center gap-1 ${collectPotential > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  <RiyalIcon className="w-2.5 h-2.5" />
                  {formatSAR(collectPotential)}
                </span>
              </p>
              <p className="flex justify-between text-[9px] font-bold">
                <span className="text-slate-400">Nilai Booking Masuk</span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <RiyalIcon className="w-2.5 h-2.5" />
                  {formatSAR(incomingValue)}
                </span>
              </p>
            </div>
          </div>

          {/* 7-day occupancy pulse */}
          <div className="lg:col-span-3 p-3.5 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2.5">Pulse 7 Hari — In-House</p>
            <div className="flex items-end gap-1.5 h-20">
              {week.map((w) => (
                <div key={w.day} className="flex-1 flex flex-col items-center gap-1 group" title={`${w.label} ${w.day}: ${w.house} in-house · ${w.arr} in · ${w.dep} out`}>
                  <div className="w-full h-14 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden flex items-end relative">
                    <div
                      className={`w-full rounded-md transition-all duration-700 group-hover:opacity-80 ${
                        w.isToday ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-indigo-400/70'
                      }`}
                      style={{ height: `${(w.house / weekMax) * 100}%` }}
                    />
                    {w.arr > 0 && <span className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500 alarm-slow" />}
                  </div>
                  <span className={`text-[8px] font-black ${w.isToday ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {w.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[8px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400/70" /> In-house</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ada check-in</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gradient-to-t from-emerald-600 to-emerald-400" /> Hari ini</span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gross Revenue */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Volume</p>
              <div className="mt-2">
                {currencyView !== 'IDR' && (
                  <p className="text-2xl font-extrabold text-slate-900 flex items-center gap-1.5">
                    <RiyalIcon className="w-5 h-5 text-amber-600" />
                    {formatSAR(totalRevenueSAR)}
                  </p>
                )}
                {currencyView !== 'SAR' && (
                  <p className={`text-sm font-bold ${currencyView === 'IDR' ? 'text-2xl text-slate-900' : 'text-slate-500'}`}>
                    {formatIDR(totalRevenueIDR)}
                  </p>
                )}
              </div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Supplier Cost:</span>
            <span className="font-semibold text-slate-700">
              {currencyView === 'IDR' ? formatIDR(totalCostIDR) : formatSAR(totalCostSAR)}
            </span>
          </div>
        </div>

        {/* Net Profit & Margin */}
        <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-2xl p-5 shadow-md border border-emerald-800 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Net Profit</p>
              <div className="mt-2">
                {currencyView !== 'IDR' && (
                  <p className="text-2xl font-extrabold text-white flex items-center gap-1.5">
                    <RiyalIcon className="w-5 h-5 text-emerald-300" />
                    {formatSAR(totalProfitSAR)}
                  </p>
                )}
                {currencyView !== 'SAR' && (
                  <p className={`text-sm font-bold ${currencyView === 'IDR' ? 'text-2xl text-white' : 'text-emerald-200'}`}>
                    {formatIDR(totalProfitIDR)}
                  </p>
                )}
              </div>
            </div>
            <div className="p-3 bg-emerald-800/60 text-emerald-300 rounded-xl border border-emerald-700">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-800/80 flex items-center justify-between text-xs">
            <span className="text-emerald-300 font-medium">Profit Margin:</span>
            <span className="bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full text-xs">
              {avgMargin.toFixed(1)}% Avg Margin
            </span>
          </div>
        </div>

        {/* Outstanding Unpaid Balance */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unpaid Balances</p>
              <div className="mt-2">
                {currencyView !== 'IDR' && (
                  <p className="text-2xl font-extrabold text-amber-600">{formatSAR(unpaidBalanceSAR)}</p>
                )}
                {currencyView !== 'SAR' && (
                  <p className={`text-sm font-bold ${currencyView === 'IDR' ? 'text-2xl text-amber-600' : 'text-slate-500'}`}>
                    {formatIDR(unpaidBalanceIDR)}
                  </p>
                )}
              </div>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Unpaid / Partial:</span>
            <button
              onClick={() => onViewBookings('Unpaid')}
              className="text-amber-700 font-bold hover:underline flex items-center space-x-1"
            >
              <span>{unpaidCount + partialCount} Bookings</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Total Bookings Breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Active Bookings</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">{totalBookings}</p>
            </div>
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-bold">{paidCount} Paid</span>
            <span className="text-amber-600 font-bold">{partialCount} Partial</span>
            <span className="text-rose-600 font-bold">{unpaidCount} Unpaid</span>
            <span className="text-slate-500 font-bold">{draftCount} Draft</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Cost vs Profit Bar breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <PieChart className="w-5 h-5 text-emerald-600" />
                <span>Financial Distribution & Margin Analysis</span>
              </h3>
              <p className="text-xs text-slate-500">
                Visualizing total revenue against costs and earned profit margin
              </p>
            </div>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
              SAR & IDR Computed
            </span>
          </div>

          {/* Visual Bar Comparison */}
          <div className="space-y-4 my-6">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-700">Gross Sales Revenue</span>
                <span className="text-slate-900">{formatSAR(totalRevenueSAR)} ({formatIDR(totalRevenueIDR)})</span>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full w-full"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-700">Supplier Hotel Costs</span>
                <span className="text-slate-600">{formatSAR(totalCostSAR)} ({formatIDR(totalCostIDR)})</span>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full"
                  style={{
                    width: `${totalRevenueSAR > 0 ? (totalCostSAR / totalRevenueSAR) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-700 font-bold">Net Profit</span>
                <span className="text-emerald-700 font-bold">{formatSAR(totalProfitSAR)} ({formatIDR(totalProfitIDR)})</span>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${totalRevenueSAR > 0 ? (totalProfitSAR / totalRevenueSAR) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Top Hotels Summary */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Top Performing Partner Hotels</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topHotels.map(([hotelName, info]) => (
                <div key={hotelName} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Hotel className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 line-clamp-1">{hotelName}</p>
                      <p className="text-[10px] text-slate-500">{info.count} booking(s)</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">
                    +{formatSAR(info.profitSAR)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status Distribution Donut & Fast Stats */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Booking Payment Status</h3>
            <p className="text-xs text-slate-500 mb-4">Breakdown of current payment collections</p>

            <div className="space-y-3">
              <div
                onClick={() => onViewBookings('Paid')}
                className="flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100/80 rounded-xl border border-emerald-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950">Fully Paid</span>
                </div>
                <span className="text-sm font-extrabold text-emerald-700">{paidCount}</span>
              </div>

              <div
                onClick={() => onViewBookings('Partial')}
                className="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100/80 rounded-xl border border-amber-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-950">Partial Deposit</span>
                </div>
                <span className="text-sm font-extrabold text-amber-700">{partialCount}</span>
              </div>

              <div
                onClick={() => onViewBookings('Unpaid')}
                className="flex items-center justify-between p-3 bg-rose-50 hover:bg-rose-100/80 rounded-xl border border-rose-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <span className="text-xs font-bold text-rose-950">Unpaid Invoice</span>
                </div>
                <span className="text-sm font-extrabold text-rose-700">{unpaidCount}</span>
              </div>

              <div
                onClick={() => onViewBookings('Draft')}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Clock className="w-5 h-5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800">Draft Quote</span>
                </div>
                <span className="text-sm font-extrabold text-slate-700">{draftCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              onClick={() => onViewBookings()}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center space-x-1"
            >
              <span>View All Saved Bookings ({totalBookings})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Unpaid Bookings Action Required Panel */}
      {unpaidBookings.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Payment Collection Action Required ({unpaidBookings.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Follow up with customers regarding outstanding balances before check-in date
                </p>
              </div>
            </div>
            <button
              onClick={() => onViewBookings('Unpaid')}
              className="text-xs font-semibold text-amber-700 hover:underline"
            >
              View Full List
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="px-3 py-2 rounded-l-lg">Invoice Ref</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Hotel</th>
                  <th className="px-3 py-2">Check-in</th>
                  <th className="px-3 py-2 text-right">Total Bill</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Remaining Balance</th>
                  <th className="px-3 py-2 text-center rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unpaidBookings.map((b) => {
                  const remSAR = b.totalSellSAR - b.amountPaidSAR;
                  const remIDR = b.totalSellIDR - b.amountPaidIDR;
                  return (
                    <tr key={b.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-3 py-3 font-bold text-slate-900">{b.bookingRef}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-800">{b.customerName}</p>
                        <p className="text-[10px] text-slate-400">{b.customerPhone}</p>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">{b.hotelName}</td>
                      <td className="px-3 py-3 text-slate-600">{b.checkInDate}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">
                        {currencyView === 'IDR' ? formatIDR(b.totalSellIDR) : formatSAR(b.totalSellSAR)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-emerald-600">
                        {currencyView === 'IDR' ? formatIDR(b.amountPaidIDR) : formatSAR(b.amountPaidSAR)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-rose-600">
                        {currencyView === 'IDR' ? formatIDR(remIDR) : formatSAR(remSAR)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => onViewVoucher(b)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors"
                        >
                          View Voucher / Remind
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
