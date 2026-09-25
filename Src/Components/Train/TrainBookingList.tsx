import React, { useMemo, useState } from 'react';
import {
  Search, ArrowUpDown, FileSpreadsheet, FileText, Edit3, Copy, Trash2,
  MessageCircle, Plus, CheckCircle2, TrainFront, ArrowRight, CalendarDays,
  Users, Wallet,
} from 'lucide-react';
import type { CompanySettings, PaymentStatus } from '../../types/booking';
import type { TrainBooking, TrainStationCode } from '../../types/train';
import { TRAIN_STATIONS } from '../../types/train';
import { bookingDisplayRoute } from '../../utils/trainFinance';
import { formatSAR, formatIDR, getProfitMarginBadge } from '../../utils/currency';

interface Props {
  bookings: TrainBooking[];
  settings: CompanySettings;
  currencyView: 'DUAL' | 'SAR' | 'IDR';
  onViewTicket: (b: TrainBooking) => void;
  onEdit: (b: TrainBooking) => void;
  onDuplicate: (b: TrainBooking) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  onNew: () => void;
  onExportExcel: (rows: TrainBooking[]) => void;
  onWhatsApp: (b: TrainBooking) => void;
}

const statusStyle: Record<PaymentStatus, string> = {
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  Partial: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
  Unpaid: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300',
  Draft: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
  Cancelled: 'bg-slate-200 text-slate-600 border-slate-400 dark:bg-slate-800 dark:text-slate-400',
};

export const TrainBookingList: React.FC<Props> = ({
  bookings, settings: _settings, currencyView,
  onViewTicket, onEdit, onDuplicate, onDelete, onMarkAsPaid, onNew, onExportExcel, onWhatsApp,
}) => {
  void _settings;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'dep' | 'revenue' | 'profit' | 'pax'>('dep');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const routeOptions = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach((b) => set.add(`${b.originCode}-${b.destinationCode}`));
    return Array.from(set).sort();
  }, [bookings]);

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => {
        if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
        if (routeFilter !== 'ALL' && `${b.originCode}-${b.destinationCode}` !== routeFilter) return false;
        if (classFilter !== 'ALL' && b.trainClass !== classFilter) return false;
        if (search.trim()) {
          const t = search.toLowerCase();
          const hay = [
            b.trainRef, b.customerName, b.travelCompany || '', b.customerPhone,
            b.legs.map((l) => l.trainNo).join(' '),
            b.passengers.map((p) => p.fullName).join(' '),
            b.vendorName || '',
          ].join(' ').toLowerCase();
          if (!hay.includes(t)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let va = 0, vb = 0;
        if (sortBy === 'dep') { va = +new Date(a.legs[0]?.departureDate || 0); vb = +new Date(b.legs[0]?.departureDate || 0); }
        else if (sortBy === 'revenue') { va = a.totalSellSAR; vb = b.totalSellSAR; }
        else if (sortBy === 'profit') { va = a.profitSAR; vb = b.profitSAR; }
        else { va = a.paxCount; vb = b.paxCount; }
        return sortOrder === 'desc' ? vb - va : va - vb;
      });
  }, [bookings, search, statusFilter, routeFilter, classFilter, sortBy, sortOrder]);

  const toggle = (s: typeof sortBy) => {
    if (sortBy === s) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(s); setSortOrder(s === 'dep' ? 'asc' : 'desc'); }
  };

  const kpi = useMemo(() => ({
    orders: filtered.length,
    pax: filtered.reduce((s, b) => s + b.paxCount, 0),
    revenue: filtered.reduce((s, b) => s + b.totalSellSAR, 0),
    profit: filtered.reduce((s, b) => s + b.profitSAR, 0),
    outstanding: filtered.reduce((s, b) => s + (b.totalSellSAR - b.amountPaidSAR), 0),
  }), [filtered]);

  const stName = (c: TrainStationCode) => TRAIN_STATIONS.find((s) => s.code === c)?.shortName ?? c;

  return (
    <div className="space-y-5 pb-16">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="p-2 bg-sky-600 text-white rounded-xl shadow"><TrainFront className="w-5 h-5" /></span>
              Haramain Train Bookings
            </h2>
            <p className="text-xs text-slate-500 mt-1">Showing {filtered.length} of {bookings.length} train orders · independent of hotel module</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => onExportExcel(filtered)} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /><span>Export Excel</span>
            </button>
            <button onClick={onNew} className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded-xl shadow text-xs transition-colors">
              <Plus className="w-4 h-4" /><span>New Train Booking</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {[
            { label: 'Orders', value: kpi.orders, icon: FileText, cls: 'text-sky-600' },
            { label: 'Passengers', value: kpi.pax, icon: Users, cls: 'text-indigo-500' },
            { label: 'Revenue SAR', value: formatSAR(kpi.revenue), icon: Wallet, cls: 'text-emerald-600', small: true },
            { label: 'Profit SAR', value: `+${formatSAR(kpi.profit)}`, icon: Wallet, cls: 'text-emerald-700', small: true },
            { label: 'Outstanding', value: formatSAR(kpi.outstanding), icon: Wallet, cls: 'text-rose-600', small: true },
          ].map((k) => (
            <div key={k.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><k.icon className={`w-3 h-3 ${k.cls}`} />{k.label}</p>
              <p className={`${k.small ? 'text-sm' : 'text-xl'} font-black text-slate-900 dark:text-white mt-1`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ref, customer, train no, passenger..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500" />
          </div>
          <div className="md:col-span-3 flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs overflow-x-auto no-scrollbar">
            {['ALL', 'Paid', 'Partial', 'Unpaid', 'Draft'].map((st) => (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold whitespace-nowrap transition-all ${statusFilter === st ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>
          <div className="md:col-span-3">
            <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white">
              <option value="ALL">All Routes</option>
              {routeOptions.map((r) => {
                const [a, b] = r.split('-') as [TrainStationCode, TrainStationCode];
                return <option key={r} value={r}>{stName(a)} → {stName(b)}</option>;
              })}
            </select>
          </div>
          <div className="md:col-span-2">
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-white">
              <option value="ALL">All Classes</option>
              <option value="Economy">Economy</option>
              <option value="Business">Business</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-sky-950 text-white uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggle('dep')}><span className="flex items-center gap-1">Ref / Departure <ArrowUpDown className="w-3 h-3 text-slate-400" /></span></th>
                <th className="px-4 py-3">Route & Schedule</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-center cursor-pointer" onClick={() => toggle('pax')}><span className="flex items-center justify-center gap-1">Pax <ArrowUpDown className="w-3 h-3 text-slate-400" /></span></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggle('revenue')}><span className="flex items-center justify-end gap-1">Sell / Paid <ArrowUpDown className="w-3 h-3 text-slate-400" /></span></th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggle('profit')}><span className="flex items-center justify-end gap-1">Profit <ArrowUpDown className="w-3 h-3 text-slate-400" /></span></th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  <TrainFront className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="font-bold text-slate-600 dark:text-slate-300">No train bookings found</p>
                  <p className="text-xs mt-1">Adjust filters or create a new train booking.</p>
                </td></tr>
              )}
              {filtered.map((b) => {
                const rem = b.totalSellSAR - b.amountPaidSAR;
                const badge = getProfitMarginBadge(b.profitMarginPercent);
                const leg = b.legs[0];
                return (
                  <tr key={b.id} className="hover:bg-sky-50/50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900 dark:text-white font-mono text-xs">{b.trainRef}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><CalendarDays className="w-3 h-3" />{leg?.departureDate} · {leg?.departureTime}</p>
                      <p className="text-[10px] text-sky-600 font-bold">{leg?.trainNo || '—'} · {b.trainClass}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center gap-1">
                        {stName(b.originCode)} <ArrowRight className="w-3.5 h-3.5 text-sky-500" /> {stName(b.destinationCode)}
                      </p>
                      <p className="text-[10px] text-slate-500">{bookingDisplayRoute(b)} · {b.tripType}{b.legs[1] ? ` · Ret ${b.legs[1].departureDate}` : ''}</p>
                      {b.vendorName && <p className="text-[10px] text-rose-500 font-semibold">Vendor: {b.vendorName}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 dark:text-white text-xs">{b.travelCompany || b.customerName}</p>
                      {b.travelCompany && <p className="text-[10px] text-slate-500">c/o {b.customerName}</p>}
                      <p className="text-[10px] text-slate-400">{b.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 font-black text-slate-900 dark:text-white"><Users className="w-3.5 h-3.5 text-indigo-500" />{b.paxCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {currencyView !== 'IDR' && <p className="font-black text-slate-900 dark:text-white text-xs">{formatSAR(b.totalSellSAR)}</p>}
                      {currencyView !== 'SAR' && <p className="text-[11px] font-semibold text-slate-500">{formatIDR(b.totalSellIDR)}</p>}
                      <p className="text-[10px] font-bold text-emerald-600">Paid {currencyView === 'IDR' ? formatIDR(b.amountPaidIDR) : formatSAR(b.amountPaidSAR)}</p>
                      {rem > 0.5 && <p className="text-[10px] font-bold text-rose-600">Bal {currencyView === 'IDR' ? formatIDR(b.totalSellIDR - b.amountPaidIDR) : formatSAR(rem)}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-black text-emerald-700 text-xs">+{currencyView === 'IDR' ? formatIDR(b.profitIDR) : formatSAR(b.profitSAR)}</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.bgClass}`}>{b.profitMarginPercent.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle[b.status]}`}>{b.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => onViewTicket(b)} title="Ticket Pass" className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg"><FileText className="w-4 h-4" /></button>
                        <button onClick={() => onWhatsApp(b)} title="WhatsApp" className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><MessageCircle className="w-4 h-4" /></button>
                        <button onClick={() => onEdit(b)} title="Edit" className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => onDuplicate(b)} title="Duplicate" className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg"><Copy className="w-4 h-4" /></button>
                        {b.status !== 'Paid' && onMarkAsPaid && (
                          <button onClick={() => onMarkAsPaid(b.id)} title="Mark Paid" className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"><CheckCircle2 className="w-4 h-4" /></button>
                        )}
                        <button onClick={() => { if (confirm(`Delete train booking ${b.trainRef}?`)) onDelete(b.id); }} title="Delete" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrainBookingList;
