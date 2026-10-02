"use client";
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Save, FileText, Plus, Trash2, Bus, User,
  Phone, Building2, Wallet, Calculator, MapPin, Clock, IdCard,
} from 'lucide-react';
import type { CompanySettings, Currency, Customer, PaymentMethod, PaymentStatus } from '../../types/booking';
import type { ArmadaBooking, ArmadaPayment, ArmadaLocationCode, ArmadaUnit, ServiceType, VehicleType } from '../../types/armada';
import { ARMADA_LOCATIONS, VEHICLE_CAPACITY, VEHICLE_TYPES } from '../../types/armada';
import { computeArmadaTotals, fareForVehicle, formatDuration, generateArmadaRef, getRouteFare, legMinutes, locationShort, summarizeArmadaPayments } from '../../utils/armadaFinance';
import { formatIDR, formatSAR, getProfitMarginBadge } from '../../utils/currency';
import { RiyalIcon } from '../RiyalIcon';

interface Props {
  initialBooking?: ArmadaBooking | null;
  settings: CompanySettings;
  customers: Customer[];
  onSave: (b: ArmadaBooking, openVoucher: boolean) => void;
  onCancel: () => void;
}

const emptyUnit = (i: number, type: VehicleType): ArmadaUnit => ({
  id: `unit-${Date.now()}-${i}`,
  vehicleType: type,
  plateNumber: '',
  driverName: '',
  driverPhone: '',
  capacity: VEHICLE_CAPACITY[type],
  note: '',
});

export const ArmadaBookingForm: React.FC<Props> = ({ initialBooking, settings, customers, onSave, onCancel }) => {
  const ib = initialBooking;
  const [armadaRef] = useState(ib?.armadaRef || generateArmadaRef());
  const [status, setStatus] = useState<PaymentStatus>(ib?.status || 'Unpaid');
  const [staffName, setStaffName] = useState(ib?.staffName || settings.defaultStaffName || 'Staff');
  const [bookingType, setBookingType] = useState<'Private' | 'Group'>(ib?.bookingType || 'Group');
  const [customerName, setCustomerName] = useState(ib?.customerName || '');
  const [travelCompany, setTravelCompany] = useState(ib?.travelCompany || '');
  const [customerPhone, setCustomerPhone] = useState(ib?.customerPhone || '');
  const [customerEmail, setCustomerEmail] = useState(ib?.customerEmail || '');
  const [customerCountry, setCustomerCountry] = useState(ib?.customerCountry || 'Indonesia');
  const [groupSize, setGroupSize] = useState(ib?.groupSize ?? 0);
  const [notes, setNotes] = useState(ib?.notes || '');

  const [serviceType, setServiceType] = useState<ServiceType>(ib?.serviceType || 'One-Way');
  const [originCode, setOriginCode] = useState<ArmadaLocationCode>(ib?.originCode || 'JED-AIR');
  const [destinationCode, setDestinationCode] = useState<ArmadaLocationCode>(ib?.destinationCode || 'MKK');
  const [vehicleType, setVehicleType] = useState<VehicleType>(ib?.vehicleType || 'Bus 45 Seat');
  const [depDate, setDepDate] = useState(ib?.legs[0]?.departureDate || new Date().toISOString().slice(0, 10));
  const [depTime, setDepTime] = useState(ib?.legs[0]?.departureTime || '08:00');
  const [arrTime, setArrTime] = useState(ib?.legs[0]?.arrivalTime || '');
  const [retDate, setRetDate] = useState(ib?.legs[1]?.departureDate || new Date().toISOString().slice(0, 10));
  const [retTime, setRetTime] = useState(ib?.legs[1]?.departureTime || '16:00');
  const [arrTimeRet, setArrTimeRet] = useState(ib?.legs[1]?.arrivalTime || '');

  const [vendorName, setVendorName] = useState(ib?.vendorName || '');
  const [vendorPic, setVendorPic] = useState(ib?.vendorPic || '');
  const [inputCurrency] = useState<Currency>(ib?.inputCurrency || 'SAR');
  const [exchangeRate] = useState(ib?.exchangeRate || settings.defaultExchangeRateSARtoIDR || 4250);
  const [costPerUnit, setCostPerUnit] = useState(ib?.costPerUnit ?? 0);
  const [sellPerUnit, setSellPerUnit] = useState(ib?.sellPerUnit ?? 0);
  const [units, setUnits] = useState<ArmadaUnit[]>(ib?.units?.length ? ib.units : [emptyUnit(1, ib?.vehicleType || 'Bus 45 Seat')]);
  const [extras, setExtras] = useState<{ id: string; description: string; cost: number; sell: number }[]>(
    ib?.extras?.map((e) => ({ ...e })) || []
  );
  const [payments, setPayments] = useState<ArmadaPayment[]>(ib?.paymentHistory?.map((p) => ({ ...p })) || []);
  const [payRate, setPayRate] = useState(ib?.paymentExchangeRate || ib?.exchangeRate || settings.defaultExchangeRateSARtoIDR || 4250);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(ib?.paymentMethod || 'Bank Transfer (BCA/Mandiri)');
  const [dueDate, setDueDate] = useState(ib?.dueDate || new Date().toISOString().slice(0, 10));
  const [custSuggest, setCustSuggest] = useState(false);

  const fare = getRouteFare(originCode, destinationCode);
  const legs = serviceType === 'Round-Trip' ? 2 : 1;

  const totals = useMemo(
    () => computeArmadaTotals({ units, costPerUnit, sellPerUnit, extras, tripLegs: legs, inputCurrency, exchangeRate }),
    [units, costPerUnit, sellPerUnit, extras, legs, inputCurrency, exchangeRate]
  );
  const pay = useMemo(
    () => summarizeArmadaPayments(payments, totals.totalSellSAR, totals.totalSellIDR),
    [payments, totals.totalSellSAR, totals.totalSellIDR]
  );
  const badge = getProfitMarginBadge(totals.profitMarginPercent);

  const applyBaseFare = () => {
    const base = fareForVehicle(originCode, destinationCode, vehicleType);
    setCostPerUnit(base);
    if (!sellPerUnit) setSellPerUnit(Math.round(base * 1.22));
  };

  const matches = useMemo(() => {
    const q = (bookingType === 'Group' ? travelCompany : customerName).trim().toLowerCase();
    if (q.length < 2) return [];
    return customers
      .filter((c) => `${c.name} ${c.travelCompany || ''} ${c.phone}`.toLowerCase().includes(q))
      .slice(0, 5);
  }, [customers, customerName, travelCompany, bookingType]);

  const addUnit = () => setUnits((u) => [...u, emptyUnit(u.length + 1, vehicleType)]);
  const updUnit = (id: string, patch: Partial<ArmadaUnit>) =>
    setUnits((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const delUnit = (id: string) => setUnits((u) => (u.length > 1 ? u.filter((x) => x.id !== id) : u));

  const addPayment = () =>
    setPayments((p) => [
      ...p,
      { id: `ap-${Date.now()}`, date: new Date().toISOString().slice(0, 10), amountSAR: 0, amountIDR: 0, exchangeRate: payRate, method: paymentMethod },
    ]);
  const updPayment = (id: string, patch: Partial<ArmadaPayment>) =>
    setPayments((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const delPayment = (id: string) => setPayments((p) => p.filter((x) => x.id !== id));

  const submit = (e: React.FormEvent, openVoucher: boolean) => {
    e.preventDefault();
    if (!customerName.trim()) { alert('Isi nama customer.'); return; }
    if (bookingType === 'Group' && !travelCompany.trim()) { alert('Isi nama travel company.'); return; }
    if (originCode === destinationCode) { alert('Lokasi asal dan tujuan tidak boleh sama.'); return; }
    if (units.some((u) => !u.plateNumber.trim())) { alert('Lengkapi nomor plat semua armada.'); return; }

    const outLeg = {
      id: ib?.legs[0]?.id || 'leg-out', direction: 'Outbound' as const,
      routeLabel: `${locationShort(originCode)} → ${locationShort(destinationCode)}`,
      departureDate: depDate, departureTime: depTime, arrivalDate: depDate, arrivalTime: arrTime,
      durationMinutes: arrTime ? legMinutes(depDate, depTime, depDate, arrTime) : fare.minutes,
    };
    const retLeg = serviceType === 'Round-Trip' ? [{
      id: ib?.legs[1]?.id || 'leg-ret', direction: 'Return' as const,
      routeLabel: `${locationShort(destinationCode)} → ${locationShort(originCode)}`,
      departureDate: retDate, departureTime: retTime, arrivalDate: retDate, arrivalTime: arrTimeRet,
      durationMinutes: arrTimeRet ? legMinutes(retDate, retTime, retDate, arrTimeRet) : fare.minutes,
    }] : [];

    let finalStatus: PaymentStatus = status;
    if (status !== 'Cancelled' && status !== 'Draft') {
      finalStatus = pay.remSAR <= 0.5 && pay.paidSAR > 0 ? 'Paid' : pay.paidSAR > 0 ? 'Partial' : 'Unpaid';
    }

    const booking: ArmadaBooking = {
      id: ib?.id || `amd-${Date.now()}`,
      armadaRef,
      createdAt: ib?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: finalStatus,
      staffName,
      source: ib?.source || 'manual',
      bookingType, customerName,
      travelCompany: bookingType === 'Group' ? travelCompany : undefined,
      customerPhone, customerEmail, customerCountry, groupSize, notes,
      serviceType, originCode, destinationCode, vehicleType,
      legs: [outLeg, ...retLeg],
      vendorName: vendorName.trim() || undefined,
      vendorPic: vendorPic.trim() || undefined,
      inputCurrency, exchangeRate,
      costPerUnit, sellPerUnit,
      units,
      extras: extras.filter((x) => x.description.trim()),
      ...totals,
      amountPaidSAR: Math.round(pay.paidSAR * 100) / 100,
      amountPaidIDR: Math.round(pay.paidIDR),
      paymentExchangeRate: payRate,
      paymentMethod, dueDate,
      paymentReference: ib?.paymentReference,
      paymentHistory: payments.filter((p) => p.amountSAR > 0 || p.amountIDR > 0),
    };
    onSave(booking, openVoucher);
  };

  const label = 'block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide';
  const field = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500';

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-16">
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Bus className="w-5 h-5 text-amber-600" /> {ib ? 'Edit Armada Booking' : 'New Umroh Fleet Booking'}
            </h2>
            <p className="text-[11px] font-mono text-slate-500">{armadaRef} · {locationShort(originCode)} → {locationShort(destinationCode)}</p>
          </div>
        </div>
        <button onClick={onCancel} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancel</button>
      </div>

      {/* Live engine banner */}
      <div className="sticky top-[140px] md:top-[93px] z-20 bg-gradient-to-r from-amber-950 via-slate-900 to-orange-950 text-white rounded-2xl p-4 shadow-2xl border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl"><Calculator className="w-5 h-5 text-amber-300" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Armada Profit Engine · {totals.unitCount} unit × {legs} leg{legs > 1 ? 's' : ''} · {totals.totalSeats} seats</p>
              <p className="text-lg font-extrabold">Sell {formatSAR(totals.totalSellSAR)} <span className="text-sm text-slate-300">({formatIDR(totals.totalSellIDR)})</span></p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
              <span className="text-slate-400 block text-[9px] font-bold uppercase">Buy / Cost</span>
              <span className="font-bold text-sm flex items-center gap-1"><RiyalIcon className="w-3 h-3 text-rose-400" />{formatSAR(totals.totalCostSAR)}</span>
            </div>
            <div className="bg-emerald-900/50 p-2 rounded-xl border border-emerald-700/60">
              <span className="text-emerald-300 block text-[9px] font-bold uppercase">Profit {pay.settled ? '· Realisasi' : '· Estimasi'}</span>
              <span className={`font-extrabold text-sm ${pay.settled ? 'text-emerald-300' : 'text-amber-300'}`}>{formatSAR(totals.profitSAR)}</span>
            </div>
            <div className="bg-amber-900/50 p-2 rounded-xl border border-amber-700/60">
              <span className="text-amber-300 block text-[9px] font-bold uppercase">Paid</span>
              <span className="font-bold text-sm text-amber-200">{formatSAR(pay.paidSAR)}</span>
            </div>
            <div className={`p-2 rounded-xl border text-center font-bold ${badge.bgClass}`}>
              <span className="text-sm">{totals.profitMarginPercent.toFixed(1)}%</span>
              <span className="block text-[9px] uppercase">{pay.overpaid ? 'Deposit' : pay.remSAR > 0.5 ? `Bal ${formatSAR(pay.remSAR)}` : 'Lunas ✓'}</span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={(e) => submit(e, false)} className="space-y-5">
        {/* 1. Ref & staff */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">1 · Reference & Staff</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div><label className={label}>Armada Ref</label><input value={armadaRef} disabled className={`${field} font-mono font-bold bg-slate-50 dark:bg-slate-800`} /></div>
            <div><label className={label}>Staff</label><input value={staffName} onChange={(e) => setStaffName(e.target.value)} className={field} /></div>
            <div><label className={label}>Status (auto-sync)</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)} className={field}>
                <option>Draft</option><option>Unpaid</option><option>Partial</option><option>Paid</option><option>Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Customer */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2"><User className="w-4 h-4 text-amber-600" />2 · Customer</h3>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold w-fit">
            {(['Private', 'Group'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setBookingType(t)}
                className={`px-4 py-1.5 rounded-lg ${bookingType === t ? (t === 'Private' ? 'bg-emerald-600' : 'bg-orange-500') + ' text-white' : 'text-slate-500'}`}>{t}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {bookingType === 'Group' && (
              <div className="sm:col-span-2 relative">
                <label className={label}>Travel Company *</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-orange-500 absolute left-3 top-2.5" />
                  <input value={travelCompany} onChange={(e) => { setTravelCompany(e.target.value); setCustSuggest(true); }} onFocus={() => setCustSuggest(true)} onBlur={() => setTimeout(() => setCustSuggest(false), 150)}
                    className="w-full pl-9 pr-3 py-2 border-2 border-orange-300 rounded-xl font-bold text-slate-900 dark:text-white bg-orange-50/40 dark:bg-slate-800" placeholder="PT ..." required />
                </div>
              </div>
            )}
            <div className="sm:col-span-2 relative">
              <label className={label}>{bookingType === 'Group' ? 'Lead Contact *' : 'Full Name *'}</label>
              <input value={customerName} onChange={(e) => { setCustomerName(e.target.value); setCustSuggest(true); }} onFocus={() => setCustSuggest(true)} onBlur={() => setTimeout(() => setCustSuggest(false), 150)}
                className={field} required placeholder="Nama sesuai ID" />
              {custSuggest && matches.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                  {matches.map((c) => (
                    <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); setCustomerName(c.name); setTravelCompany(c.travelCompany || ''); if (c.phone) setCustomerPhone(c.phone); if (c.email) setCustomerEmail(c.email); if (c.country) setCustomerCountry(c.country); setBookingType(c.bookingType); setCustSuggest(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800 first:border-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{c.travelCompany || c.name}</p>
                      <p className="text-[10px] text-slate-500">{c.phone}{c.country ? ` · ${c.country}` : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div><label className={label}>WhatsApp *</label><div className="relative"><Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" /><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white" required /></div></div>
            <div><label className={label}>Email</label><input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className={field} /></div>
            <div><label className={label}>Country</label><input value={customerCountry} onChange={(e) => setCustomerCountry(e.target.value)} className={field} /></div>
            <div><label className={label}>Jumlah Jamaah</label><input type="number" min={0} value={groupSize} onChange={(e) => setGroupSize(Number(e.target.value))} className={field} /></div>
            <div><label className={label}>Vendor Transport</label><input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Al Haramain Transport" className={field} /></div>
            <div><label className={label}>Vendor PIC</label><input value={vendorPic} onChange={(e) => setVendorPic(e.target.value)} className={field} /></div>
            <div className="sm:col-span-2"><label className={label}>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} /></div>
          </div>
        </div>

        {/* 3. Route & Schedule */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-amber-600" />3 · Route & Schedule</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl font-bold">
              {(['One-Way', 'Round-Trip'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setServiceType(t)} className={`px-4 py-1.5 rounded-lg ${serviceType === t ? 'bg-amber-600 text-white' : 'text-slate-500'}`}>{t}</button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 font-semibold ml-auto">Base charter {vehicleType}: SAR {fareForVehicle(originCode, destinationCode, vehicleType)}/unit · ±{formatDuration(fare.minutes)}</span>
            <button type="button" onClick={applyBaseFare} className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">Apply base fare</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div><label className={label}>Origin *</label>
              <select value={originCode} onChange={(e) => setOriginCode(e.target.value as typeof originCode)} className={field}>
                {ARMADA_LOCATIONS.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select></div>
            <div><label className={label}>Destination *</label>
              <select value={destinationCode} onChange={(e) => setDestinationCode(e.target.value as typeof destinationCode)} className={field}>
                {ARMADA_LOCATIONS.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select></div>
            <div><label className={label}>Vehicle Type *</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)} className={field}>
                {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select></div>
            <div><label className={label}>Arrival Time</label><input type="time" value={arrTime} onChange={(e) => setArrTime(e.target.value)} className={field} /></div>
            <div><label className={label}>Departure Date *</label><input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} className={field} required /></div>
            <div><label className={label}>Departure Time *</label><input type="time" value={depTime} onChange={(e) => setDepTime(e.target.value)} className={field} required /></div>
            {serviceType === 'Round-Trip' && (
              <>
                <div><label className={label}>Return Arrival</label><input type="time" value={arrTimeRet} onChange={(e) => setArrTimeRet(e.target.value)} className={field} /></div>
                <div className="hidden lg:block" />
                <div><label className={label}>Return Date *</label><input type="date" value={retDate} onChange={(e) => setRetDate(e.target.value)} className={field} required /></div>
                <div><label className={label}>Return Time *</label><input type="time" value={retTime} onChange={(e) => setRetTime(e.target.value)} className={field} required /></div>
              </>
            )}
          </div>
          <p className="text-[10px] text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Estimated journey {formatDuration(fare.minutes)} · {legs} leg{legs > 1 ? 's' : ''} × {units.length} unit</p>
        </div>

        {/* 4. Fleet Units */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2"><Bus className="w-4 h-4 text-amber-600" />4 · Fleet Units ({units.length}) · {totals.totalSeats} seats</h3>
            <button type="button" onClick={addUnit} className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg"><Plus className="w-3.5 h-3.5" />Add Unit</button>
          </div>
          <div className="space-y-2">
            {units.map((u, i) => (
              <div key={u.id} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
                <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                  <span className="w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center">{i + 1}</span>
                </div>
                <div className="sm:col-span-3"><label className={label}>Vehicle Type</label>
                  <select value={u.vehicleType} onChange={(e) => { const vt = e.target.value as VehicleType; updUnit(u.id, { vehicleType: vt, capacity: VEHICLE_CAPACITY[vt] }); }} className={field}>
                    {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select></div>
                <div className="sm:col-span-2"><label className={label}>Plate No *</label><input value={u.plateNumber} onChange={(e) => updUnit(u.id, { plateNumber: e.target.value })} className={`${field} font-mono`} placeholder="JED-4821" /></div>
                <div className="sm:col-span-2"><label className={label}>Driver</label><input value={u.driverName} onChange={(e) => updUnit(u.id, { driverName: e.target.value })} className={field} placeholder="Nama sopir" /></div>
                <div className="sm:col-span-2"><label className={label}>Driver Phone</label><input value={u.driverPhone} onChange={(e) => updUnit(u.id, { driverPhone: e.target.value })} className={field} placeholder="+9665..." /></div>
                <div className="sm:col-span-1"><label className={label}>Seats</label><input type="number" min={0} value={u.capacity} onChange={(e) => updUnit(u.id, { capacity: Number(e.target.value) })} className={field} /></div>
                <div className="sm:col-span-1 flex justify-end">
                  <button type="button" onClick={() => delUnit(u.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Fares */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2"><IdCard className="w-4 h-4 text-amber-600" />5 · Charter Buy / Sell (per unit, {inputCurrency})</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div><label className="block text-[10px] font-bold text-rose-700 mb-1">Buy / Cost per Unit (SAR)</label>
              <input type="number" min={0} value={costPerUnit} onChange={(e) => setCostPerUnit(Number(e.target.value))} className="w-full px-3 py-2 border border-rose-300 rounded-xl font-bold text-rose-900 dark:text-rose-300 bg-white dark:bg-slate-900" /></div>
            <div><label className="block text-[10px] font-bold text-emerald-700 mb-1">Sell per Unit (SAR)</label>
              <input type="number" min={0} value={sellPerUnit} onChange={(e) => setSellPerUnit(Number(e.target.value))} className="w-full px-3 py-2 border border-emerald-300 rounded-xl font-bold text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-900" /></div>
            <div className="col-span-2 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Sell {formatSAR(totals.totalSellSAR)} · Cost {formatSAR(totals.totalCostSAR)}</span>
              <span className="font-black text-emerald-700">Profit +{formatSAR(totals.profitSAR)} ({totals.profitMarginPercent.toFixed(1)}%)</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Extra items (handling, tol, parkir, tips sopir)</span>
            <button type="button" onClick={() => setExtras((e) => [...e, { id: `ex-${Date.now()}`, description: '', cost: 0, sell: 0 }])}
              className="text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">+ Add Extra</button>
          </div>
          {extras.map((x) => (
            <div key={x.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
              <div className="sm:col-span-6"><label className={label}>Description</label><input value={x.description} onChange={(e) => setExtras((a) => a.map((y) => y.id === x.id ? { ...y, description: e.target.value } : y))} className={field} /></div>
              <div className="sm:col-span-2"><label className={label}>Cost</label><input type="number" value={x.cost} onChange={(e) => setExtras((a) => a.map((y) => y.id === x.id ? { ...y, cost: Number(e.target.value) } : y))} className={field} /></div>
              <div className="sm:col-span-3"><label className={label}>Sell</label><input type="number" value={x.sell} onChange={(e) => setExtras((a) => a.map((y) => y.id === x.id ? { ...y, sell: Number(e.target.value) } : y))} className={field} /></div>
              <div className="sm:col-span-1 flex justify-end"><button type="button" onClick={() => setExtras((a) => a.filter((y) => y.id !== x.id))} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div>
            </div>
          ))}
        </div>

        {/* 6. Payments */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" />6 · Payments ({payments.length})</h3>
            <button type="button" onClick={addPayment} className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg"><Plus className="w-3.5 h-3.5" />Add Payment</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div><label className={label}>Payment Rate (1 SAR = IDR)</label><input type="number" value={payRate} onChange={(e) => setPayRate(Number(e.target.value))} className={field} /></div>
            <div><label className={label}>Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={field}>
                <option>Bank Transfer (Al Rajhi)</option><option>Bank Transfer (BCA/Mandiri)</option><option>Credit Card</option><option>Cash</option><option>Credit/Invoice</option>
              </select></div>
            <div><label className={label}>Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} /></div>
          </div>
          {payments.length === 0 && <p className="text-[11px] italic text-slate-400 text-center py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">Belum ada pembayaran. Tambahkan DP / tenor / pelunasan.</p>}
          {payments.map((p, i) => (
            <div key={p.id} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end bg-emerald-50/50 dark:bg-slate-800/60 border border-emerald-200 dark:border-slate-700 rounded-xl p-2.5">
              <div className="col-span-2 sm:col-span-1 flex items-center justify-center"><span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">{i + 1}</span></div>
              <div className="sm:col-span-2"><label className={label}>Date</label><input type="date" value={p.date.slice(0, 10)} onChange={(e) => updPayment(p.id, { date: e.target.value })} className={field} /></div>
              <div className="sm:col-span-2"><label className={label}>Amount SAR</label><input type="number" value={p.amountSAR} onChange={(e) => { const v = Number(e.target.value); const r = p.exchangeRate || payRate; updPayment(p.id, { amountSAR: v, amountIDR: Math.round(v * r) }); }} className={field} /></div>
              <div className="sm:col-span-2"><label className={label}>Rate</label><input type="number" value={p.exchangeRate} onChange={(e) => { const r = Number(e.target.value); updPayment(p.id, { exchangeRate: r, amountIDR: Math.round(p.amountSAR * r) }); }} className={field} /></div>
              <div className="sm:col-span-2"><label className={label}>IDR (auto)</label><input type="number" value={p.amountIDR} onChange={(e) => { const v = Number(e.target.value); const r = p.exchangeRate || payRate; updPayment(p.id, { amountIDR: v, amountSAR: r > 0 ? Math.round((v / r) * 100) / 100 : 0 }); }} className={field} /></div>
              <div className="sm:col-span-2"><label className={label}>Ref</label><input value={p.reference || ''} onChange={(e) => updPayment(p.id, { reference: e.target.value })} className={`${field} font-mono`} placeholder="TRX" /></div>
              <div className="sm:col-span-1 flex justify-end"><button type="button" onClick={() => delPayment(p.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div>
              <p className="col-span-2 sm:col-span-12 text-[10px] text-slate-500">= {formatIDR(p.amountIDR)} @ {p.exchangeRate || payRate}</p>
            </div>
          ))}
          <div className="bg-slate-900 text-white rounded-xl px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span>Paid <b className="text-emerald-400">{formatSAR(pay.paidSAR)}</b> <span className="text-slate-400">({formatIDR(pay.paidIDR)})</span></span>
            <span className={`font-black ${pay.overpaid ? 'text-teal-300' : pay.remSAR > 0.5 ? 'text-rose-300' : 'text-emerald-300'}`}>
              {pay.overpaid ? `Deposit ${formatSAR(Math.abs(pay.remSAR))}` : pay.remSAR > 0.5 ? `Outstanding ${formatSAR(pay.remSAR)}` : '✓ LUNAS'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 text-sm">Cancel</button>
          <button type="submit" className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm"><Save className="w-4 h-4" />Save</button>
          <button type="button" onClick={(e) => submit(e, true)} className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-orange-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg text-sm"><FileText className="w-4 h-4" />Save & Charter Voucher</button>
        </div>
      </form>
    </div>
  );
};

export default ArmadaBookingForm;
