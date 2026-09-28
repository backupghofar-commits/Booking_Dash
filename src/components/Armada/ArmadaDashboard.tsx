import React from 'react';
import { Bus, Users, Wallet, TrendingUp, AlertCircle, ArrowRight, Plus, Armchair } from 'lucide-react';
import type { ArmadaBooking } from '../../types/armada';
import { formatIDR, formatSAR } from '../../utils/currency';
import { bookingDisplayRoute } from '../../utils/armadaFinance';

interface Props {
  bookings: ArmadaBooking[];
  onNew: () => void;
  onOpenList: () => void;
  onViewVoucher: (b: ArmadaBooking) => void;
}

export const ArmadaDashboard: React.FC<Props> = ({ bookings, onNew, onOpenList, onViewVoucher }) => {
  const live = bookings.filter((b) => b.status !== 'Cancelled');
  const revenue = live.reduce((s, b) => s + b.totalSellSAR, 0);
  const profit = live.reduce((s, b) => s + b.profitSAR, 0);
  const outstanding = live.reduce((s, b) => s + Math.max(0, b.totalSellSAR - b.amountPaidSAR), 0);
  const units = live.reduce((s, b) => s + b.unitCount, 0);
  const jamaah = live.reduce((s, b) => s + b.groupSize, 0);
  const upcoming = [...live]
    .filter((b) => b.legs[0]?.departureDate >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.legs[0].departureDate.localeCompare(b.legs[0].departureDate))
    .slice(0, 5);
  const unpaid = live.filter((b) => b.status === 'Unpaid' || b.status === 'Partial').slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-amber-950 via-orange-900 to-amber-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <Bus className="absolute -right-6 -bottom-8 w-48 h-48 text-amber-500/10" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-amber-300 uppercase">Umroh Ground Transport</p>
            <h2 className="text-2xl font-extrabold mt-1">Armada Umroh Module</h2>
            <p className="text-xs text-amber-200/80 mt-1">Bus · Coaster · Hiace · GMC — charter armada Makkah · Madinah · Jeddah, terpisah dari booking hotel.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onOpenList} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 font-bold px-4 py-2.5 rounded-xl text-xs">
              Open Charter List <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={onNew} className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs">
              <Plus className="w-4 h-4" /> New Armada Booking
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { l: 'Orders', v: String(live.length), s: `${bookings.length - live.length} cancelled`, c: 'text-amber-600', i: Bus },
          { l: 'Units', v: String(units), s: 'vehicles', c: 'text-orange-500', i: Bus },
          { l: 'Jamaah', v: String(jamaah), s: 'passengers moved', c: 'text-indigo-500', i: Users },
          { l: 'Revenue', v: formatSAR(revenue), s: formatIDR(live.reduce((x, b) => x + b.totalSellIDR, 0)), c: 'text-emerald-600', i: Wallet },
          { l: 'Profit', v: `+${formatSAR(profit)}`, s: `${revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0.0'}% margin`, c: 'text-emerald-700', i: TrendingUp },
          { l: 'Outstanding', v: formatSAR(outstanding), s: 'to collect', c: 'text-rose-600', i: AlertCircle },
        ].map((k) => (
          <div key={k.l} className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><k.i className={`w-3.5 h-3.5 ${k.c}`} />{k.l}</p>
            <p className="text-lg font-black text-slate-900 dark:text-white mt-1 truncate">{k.v}</p>
            <p className="text-[10px] text-slate-400 truncate">{k.s}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3">Upcoming Departures</h3>
          {upcoming.length === 0 && <p className="text-xs text-slate-400 italic">No upcoming departures.</p>}
          <div className="space-y-2">
            {upcoming.map((b) => (
              <button key={b.id} onClick={() => onViewVoucher(b)} className="w-full text-left flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{b.armadaRef}</p>
                  <p className="text-[10px] text-slate-500 truncate">{b.travelCompany || b.customerName} · {b.unitCount}× {b.vehicleType} · {bookingDisplayRoute(b)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-black text-amber-700">{b.legs[0]?.departureDate}</p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-0.5 justify-end"><Armchair className="w-3 h-3" />{b.totalSeats}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900 p-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Collection Needed
          </h3>
          {unpaid.length === 0 && <p className="text-xs text-emerald-600 font-bold">✓ All settled — nothing to collect.</p>}
          <div className="space-y-2">
            {unpaid.map((b) => (
              <button key={b.id} onClick={() => onViewVoucher(b)} className="w-full text-left flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 border border-amber-100 dark:border-amber-900 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white font-mono">{b.armadaRef}</p>
                  <p className="text-[10px] text-slate-500 truncate">{b.travelCompany || b.customerName}</p>
                </div>
                <p className="text-xs font-black text-rose-600 flex-shrink-0">{formatSAR(b.totalSellSAR - b.amountPaidSAR)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArmadaDashboard;
