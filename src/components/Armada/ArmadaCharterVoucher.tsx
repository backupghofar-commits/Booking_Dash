import React, { useRef, useState } from 'react';
import {
  ArrowLeft, Printer, Download, MessageCircle, Mail, Edit3, Copy, Check,
  Bus, Users, MapPin, Clock, Loader2, FileSpreadsheet, Armchair,
} from 'lucide-react';
import type { CompanySettings } from '../../types/booking';
import type { ArmadaBooking } from '../../types/armada';
import { ARMADA_LOCATIONS } from '../../types/armada';
import { formatDuration } from '../../utils/armadaFinance';
import { formatIDR } from '../../utils/currency';
import { exportSinglePagePDF, shareArmadaViaEmail, shareArmadaViaWhatsApp, exportArmadaToExcel, getArmadaWhatsAppMessage } from '../../utils/armadaExport';

interface Props {
  booking: ArmadaBooking;
  settings: CompanySettings;
  onBack: () => void;
  onEdit: () => void;
}

const idn = (n: number, d = 0) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.round((n || 0) * 100) / 100);

export const ArmadaCharterVoucher: React.FC<Props> = ({ booking: b, settings, onBack, onEdit }) => {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'idle' | 'ok' | 'err'>('idle');
  const [copied, setCopied] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  const legal = settings.legalEntityName || 'PT. TAMIMA JAYA WISATA';
  const balSAR = b.totalSellSAR - b.amountPaidSAR;
  const overpaid = balSAR < -0.5;
  const locName = (c: string) => ARMADA_LOCATIONS.find((s) => s.code === c)?.shortName ?? c;

  const download = async () => {
    setBusy(true); setDone('idle');
    await new Promise((r) => setTimeout(r, 120));
    const ok = await exportSinglePagePDF('armada-voucher-doc', `Armada_Charter_${b.armadaRef}`);
    setBusy(false); setDone(ok ? 'ok' : 'err');
    setTimeout(() => setDone('idle'), 2500);
  };

  const copy = () => {
    navigator.clipboard.writeText(getArmadaWhatsAppMessage(b, settings));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const btn = 'flex items-center gap-1.5 font-bold px-3 py-2 rounded-xl text-xs shadow-sm transition-colors';

  return (
    <div className="max-w-[880px] mx-auto space-y-4 pb-20">
      <div className="print:hidden bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-16 z-30">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest block">Umroh Fleet Charter Voucher</span>
            <h2 className="text-lg font-extrabold font-mono tracking-wide">{b.armadaRef}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => window.print()} className={`${btn} bg-amber-600 hover:bg-amber-700 text-white`}><Printer className="w-4 h-4" /><span>Print</span></button>
          <button onClick={download} disabled={busy} className={`${btn} border ${done === 'ok' ? 'bg-emerald-600 border-emerald-500 text-white' : done === 'err' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-800 text-slate-200 border-slate-700'}`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : done === 'ok' ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4 text-amber-400" />}
            <span>{busy ? 'Rendering...' : done === 'ok' ? 'Saved!' : 'Save PDF'}</span>
          </button>
          <button onClick={() => exportArmadaToExcel([b], `Armada_Charter_${b.armadaRef}`)} className={`${btn} bg-slate-800 text-slate-200 border border-slate-700`}><FileSpreadsheet className="w-4 h-4 text-emerald-400" /><span>Excel</span></button>
          <button onClick={() => shareArmadaViaWhatsApp(b, settings)} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}><MessageCircle className="w-4 h-4" /><span>WhatsApp</span></button>
          <button onClick={() => shareArmadaViaEmail(b, settings)} className={`${btn} bg-slate-800 text-slate-200 border border-slate-700`}><Mail className="w-4 h-4 text-amber-400" /><span>Email</span></button>
          <button onClick={copy} className={`${btn} bg-slate-800 text-slate-200 border border-slate-700`}>{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}<span>{copied ? 'Copied' : 'Copy'}</span></button>
          <button onClick={onEdit} className={`${btn} bg-slate-800 text-slate-200 border border-slate-700`}><Edit3 className="w-4 h-4 text-amber-400" /><span>Edit</span></button>
        </div>
      </div>

      <div
        ref={docRef}
        id="armada-voucher-doc"
        className="pdf-doc bg-white text-slate-900 w-full max-w-[820px] mx-auto shadow-2xl border border-slate-200 text-[11px] leading-snug"
        style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
      >
        <div className="p-7 space-y-4">
          {/* Header */}
          <div className="flex justify-between items-start gap-4 border-b-4 border-amber-600 pb-4">
            <div className="flex items-center gap-3">
              {settings.logoUrl
                ? <img src={settings.logoUrl} alt="logo" className="h-12 max-w-[140px] object-contain" />
                : <div className="w-12 h-12 rounded-xl bg-amber-950 flex items-center justify-center"><Bus className="w-7 h-7 text-amber-400" /></div>}
              <div>
                <p className="text-[9px] font-bold tracking-widest text-amber-600 uppercase">Issued By</p>
                <h1 className="text-[22px] font-black text-amber-700 tracking-tight leading-tight">{legal}</h1>
                <p className="text-[10px] italic text-slate-500">{settings.tagline}</p>
                <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3 text-amber-600" />{settings.indonesiaAddress || settings.address}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="bg-gradient-to-r from-amber-600 to-orange-700 text-white px-5 py-2.5 rounded shadow">
                <p className="text-[16px] font-black tracking-wide flex items-center gap-2 justify-end"><Bus className="w-5 h-5" />FLEET CHARTER VOUCHER</p>
                <p className="text-[9px] text-amber-100">Umroh Ground Transport</p>
              </div>
              <p className="text-[11px] mt-2">Ref: <span className="font-black text-amber-700 font-mono">{b.armadaRef}</span></p>
              <p className="text-[10px] text-slate-500">Issued: {new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              <span className={`inline-block mt-1 px-2.5 py-0.5 text-[9px] font-black border rounded ${
                b.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                : b.status === 'Partial' ? 'bg-amber-100 text-amber-800 border-amber-400'
                : b.status === 'Draft' ? 'bg-slate-200 text-slate-700 border-slate-400'
                : 'bg-rose-100 text-rose-800 border-rose-400'}`}>
                {b.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Route hero */}
          <div className="rounded-xl overflow-hidden border border-amber-200">
            <div className="bg-gradient-to-r from-amber-950 via-orange-900 to-amber-950 text-white px-5 py-4 flex items-center justify-between gap-3">
              <div className="text-center flex-1">
                <p className="text-[9px] font-bold text-amber-300 tracking-widest">{b.originCode}</p>
                <p className="text-xl font-black">{locName(b.originCode)}</p>
                <p className="text-[10px] text-amber-200">{b.legs[0]?.departureDate} · {b.legs[0]?.departureTime}</p>
              </div>
              <div className="flex flex-col items-center px-2">
                <div className="flex items-center w-28 sm:w-40">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="flex-1 h-0.5 bg-gradient-to-r from-amber-400 to-orange-400" />
                  <Bus className="w-6 h-6 text-white mx-1" />
                  <span className="flex-1 h-0.5 bg-gradient-to-r from-orange-400 to-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                </div>
                <p className="text-[9px] font-bold text-amber-200 mt-1">{b.unitCount}× {b.vehicleType} · {formatDuration(b.legs[0]?.durationMinutes || 0)}</p>
                <p className="text-[9px] text-amber-300">{b.serviceType}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-[9px] font-bold text-amber-300 tracking-widest">{b.destinationCode}</p>
                <p className="text-xl font-black">{locName(b.destinationCode)}</p>
                <p className="text-[10px] text-amber-200">{b.legs[0]?.arrivalDate} · {b.legs[0]?.arrivalTime || '—'}</p>
              </div>
            </div>
            {b.legs[1] && (
              <div className="bg-orange-50 border-t border-orange-200 px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-orange-900">
                <span className="font-black uppercase tracking-wider text-[9px]">Return leg</span>
                <span><b>{b.legs[1].routeLabel}</b></span>
                <span>{b.legs[1].departureDate} · {b.legs[1].departureTime}</span>
                <span className="text-slate-500">→ arrive {b.legs[1].arrivalTime || '—'}</span>
              </div>
            )}
          </div>

          {/* Customer + booking info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-300 rounded overflow-hidden">
              <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-black tracking-wider">CUSTOMER / BOOKER</span>
                <span className={`ml-auto text-[8px] font-black px-1.5 py-0.5 rounded ${b.bookingType === 'Group' ? 'bg-orange-500' : 'bg-emerald-500'}`}>{b.bookingType?.toUpperCase() || 'PRIVATE'}</span>
              </div>
              <table className="w-full text-[10.5px]"><tbody>
                {[
                  ['Booker', b.customerName],
                  ...(b.travelCompany ? [['Company', b.travelCompany] as [string, string]] : []),
                  ['Phone / WA', b.customerPhone || '-'],
                  ['Jamaah', `${b.groupSize} pax · ${b.totalSeats} seats available`],
                ].map(([k, v], i) => (
                  <tr key={k} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-3 py-1.5 text-slate-500 w-[36%] border-r border-slate-200">{k}</td>
                    <td className="px-3 py-1.5 font-bold">{v}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
            <div className="border border-slate-300 rounded overflow-hidden">
              <div className="bg-amber-600 text-white px-3 py-1.5 text-[10px] font-black tracking-wider">CHARTER DETAIL</div>
              <table className="w-full text-[10.5px]"><tbody>
                {[
                  ['Vehicle', `${b.vehicleType} × ${b.unitCount}`],
                  ['Vendor', b.vendorName || '-'],
                  ['Staff', b.staffName],
                  ['Due Date', b.dueDate || '-'],
                ].map(([k, v], i) => (
                  <tr key={k} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-3 py-1.5 text-slate-500 w-[34%] border-r border-slate-200">{k}</td>
                    <td className="px-3 py-1.5 font-bold">{v}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </div>

          {/* Fleet manifest */}
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-700 mb-1.5 flex items-center gap-1.5"><Bus className="w-4 h-4 text-amber-600" />FLEET MANIFEST & DRIVERS</p>
            <table className="w-full text-[10px] border border-slate-300 rounded overflow-hidden">
              <thead><tr className="bg-slate-100 text-slate-600 text-[9px] font-black">
                <th className="px-2 py-1.5 text-left w-8">No</th><th className="px-2 py-1.5 text-left">Vehicle</th>
                <th className="px-2 py-1.5 text-left">Plate</th><th className="px-2 py-1.5 text-center">Seats</th>
                <th className="px-2 py-1.5 text-left">Driver</th><th className="px-2 py-1.5 text-left">Driver Phone</th>
                <th className="px-2 py-1.5 text-right">Charter SAR</th>
              </tr></thead>
              <tbody>
                {b.units.map((u, i) => (
                  <tr key={u.id} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                    <td className="px-2 py-1">{i + 1}</td>
                    <td className="px-2 py-1 font-bold">{u.vehicleType}</td>
                    <td className="px-2 py-1 font-mono text-slate-500">{u.plateNumber || '-'}</td>
                    <td className="px-2 py-1 text-center"><span className="inline-flex items-center gap-0.5"><Armchair className="w-3 h-3 text-slate-400" />{u.capacity}</span></td>
                    <td className="px-2 py-1 font-bold">{u.driverName || '-'}</td>
                    <td className="px-2 py-1 font-mono text-slate-500">{u.driverPhone || '-'}</td>
                    <td className="px-2 py-1 text-right font-bold">SAR {idn(b.sellPerUnit * (b.serviceType === 'Round-Trip' ? 2 : 1))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fare breakdown */}
          <div className="border border-slate-300 rounded overflow-hidden">
            <table className="w-full text-[10.5px]">
              <tbody>
                <tr className="bg-slate-50">
                  <td className="px-3 py-1.5">Charter: {b.unitCount} unit × {b.legs.length} leg{b.legs.length > 1 ? 's' : ''} × SAR {idn(b.sellPerUnit)} ({b.vehicleType})</td>
                  <td className="px-3 py-1.5 text-right font-black">SAR {idn(b.sellPerUnit * b.unitCount * b.legs.length)}</td>
                </tr>
                {b.extras.map((x) => (
                  <tr key={x.id} className="bg-amber-50/50">
                    <td className="px-3 py-1.5 italic">+ {x.description}</td>
                    <td className="px-3 py-1.5 text-right font-bold">SAR {idn(x.sell)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-gradient-to-r from-amber-600 to-orange-700 text-white px-3 py-2 flex justify-between items-center">
              <span className="text-[11px] font-black tracking-widest">GRAND TOTAL</span>
              <span className="text-[15px] font-black">SAR {idn(b.totalSellSAR)}</span>
            </div>
            <div className="bg-slate-900 text-white px-3 py-1.5 flex justify-between items-center">
              <span className="text-[10px] font-bold">EQUIVALENT IDR (rate {idn(b.exchangeRate)})</span>
              <span className="text-[12px] font-black">{formatIDR(b.totalSellIDR)}</span>
            </div>
          </div>

          {/* Payment summary */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="border-2 border-emerald-400 bg-emerald-50 rounded px-2 py-2 text-center">
              <p className="text-[8px] font-black text-emerald-700">TOTAL</p>
              <p className="text-[13px] font-black text-emerald-800">SAR {idn(b.totalSellSAR)}</p>
            </div>
            <div className="border-2 border-blue-400 bg-blue-50 rounded px-2 py-2 text-center">
              <p className="text-[8px] font-black text-blue-700">PAID</p>
              <p className="text-[13px] font-black text-blue-800">SAR {idn(b.amountPaidSAR)}</p>
              <p className="text-[9px] text-blue-600">{formatIDR(b.amountPaidIDR)}</p>
            </div>
            <div className={`border-2 rounded px-2 py-2 text-center ${overpaid ? 'border-teal-500 bg-teal-50' : 'border-rose-400 bg-rose-50'}`}>
              <p className={`text-[8px] font-black ${overpaid ? 'text-teal-700' : 'text-rose-700'}`}>{overpaid ? 'BALANCE DEPOSIT' : 'OUTSTANDING'}</p>
              <p className={`text-[13px] font-black ${overpaid ? 'text-teal-700' : 'text-rose-700'}`}>SAR {idn(Math.abs(balSAR), 2)}</p>
            </div>
          </div>

          {b.paymentHistory.length > 0 && (
            <table className="w-full text-[9.5px] border border-slate-200">
              <thead><tr className="bg-slate-100 text-slate-600 text-[8.5px] font-black">
                <th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Date</th>
                <th className="px-2 py-1 text-left">Method</th><th className="px-2 py-1 text-right">SAR</th>
                <th className="px-2 py-1 text-right">IDR</th><th className="px-2 py-1 text-left">Note</th>
              </tr></thead>
              <tbody>
                {b.paymentHistory.map((p, i) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-2 py-1">{i + 1}</td>
                    <td className="px-2 py-1">{p.date.slice(0, 10)}</td>
                    <td className="px-2 py-1">{p.method}</td>
                    <td className="px-2 py-1 text-right font-bold">{idn(p.amountSAR, 2)}</td>
                    <td className="px-2 py-1 text-right font-bold text-emerald-700">{idn(p.amountIDR)}</td>
                    <td className="px-2 py-1 text-slate-500">{p.note || p.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="border-2 border-amber-400 bg-amber-50 rounded px-3 py-2 text-[10px] text-slate-700">
            <b className="text-amber-800">TRAVEL NOTE:</b> Driver akan menghubungi ketua rombongan sebelum penjemputan. Pastikan jamaah siap 15 menit sebelum keberangkatan. Tunjukkan voucher ini kepada sopir/vendor saat boarding.
          </div>

          <div className="flex justify-between items-end pt-2 border-t border-slate-200">
            <div className="text-[9px] text-slate-500 max-w-[60%]">
              <p>Terima kasih telah mempercayakan transportasi umroh Anda kepada <b className="text-amber-700">{legal}</b>.</p>
              <p className="italic mt-1">System-generated voucher · {b.armadaRef} · verify at counter</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500">Authorized,</p>
              <div className="h-10" />
              <p className="text-[11px] font-black">( {(settings.bookingManagerName || 'GHOFAR').toUpperCase()} )</p>
              <p className="text-[9px] text-slate-500">{settings.bookingManagerRole || 'Booking Manager'}</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-950 text-white text-center text-[9px] font-bold tracking-widest py-2 px-4 flex items-center justify-center gap-1">
          <Clock className="w-3 h-3" />{legal.toUpperCase()} · UMROH FLEET SERVICES · {b.armadaRef}
        </div>
      </div>
    </div>
  );
};

export default ArmadaCharterVoucher;
