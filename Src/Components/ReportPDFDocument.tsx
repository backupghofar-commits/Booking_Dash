import React from 'react';
import { Building2, Lock, Users, Wallet, CreditCard, CalendarDays } from 'lucide-react';
import { Booking, CompanySettings } from '../types/booking';
import { resolvePaymentHistory, resolveVendorPayments } from '../utils/export';
import { averageTransactionRate } from '../utils/exchangeRate';

interface ReportPDFDocumentProps {
  id: string;
  bookings: Booking[];
  settings: CompanySettings;
  variant: 'customer' | 'finance';
  filterMeta: string;
}

const idr = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const sar = (n: number) => 'SAR ' + (Math.round((n || 0) * 100) / 100).toLocaleString('id-ID', { minimumFractionDigits: 2 });

const statusPill: Record<string, string> = {
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-400',
  Partial: 'bg-amber-100 text-amber-800 border-amber-400',
  Unpaid: 'bg-rose-100 text-rose-800 border-rose-400',
  Draft: 'bg-slate-100 text-slate-600 border-slate-300',
  Cancelled: 'bg-slate-200 text-slate-500 border-slate-400',
};

/**
 * Printable, multi-page portrait report with full payment history.
 * customer variant: billing + customer termin only.
 * finance variant: + cost, profit, margin and vendor payments (confidential).
 */
export const ReportPDFDocument: React.FC<ReportPDFDocumentProps> = ({ id, bookings, settings, variant, filterMeta }) => {
  const finance = variant === 'finance';
  const legal = settings.legalEntityName || settings.companyName;

  const totals = bookings.reduce(
    (a, b) => {
      a.cost += b.totalCostSAR;
      a.sell += b.totalSellSAR;
      a.sellIDR += b.totalSellIDR;
      a.paid += b.amountPaidSAR;
      a.paidIDR += b.amountPaidIDR;
      a.vendor += resolveVendorPayments(b).reduce((s, p) => s + p.amountSAR, 0);
      return a;
    },
    { cost: 0, sell: 0, sellIDR: 0, paid: 0, paidIDR: 0, vendor: 0 }
  );
  const profit = totals.sell - totals.cost;
  const margin = totals.sell > 0 ? (profit / totals.sell) * 100 : 0;
  const balance = totals.sell - totals.paid;
  const averageRate = averageTransactionRate(
    bookings.flatMap((booking) => booking.paymentHistory || []),
    settings.defaultExchangeRateSARtoIDR
  );

  const th = 'px-2 py-1.5 text-left text-[8px] font-black uppercase tracking-wider text-white bg-slate-900';
  const td = 'px-2 py-1 text-[9px] text-slate-700 border-b border-slate-100';

  return (
    <div id={id} className="pdf-doc bg-white text-slate-900 w-[780px] p-8 text-[11px] leading-snug" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
      {/* ===== Letterhead ===== */}
      <div className="flex items-start justify-between border-b-4 border-orange-500 pb-4">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="logo" className="h-12 max-w-[140px] object-contain" />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-slate-900 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-emerald-400" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-black tracking-tight">{legal}</h1>
            <p className="text-[9px] text-slate-500 italic">{settings.tagline}</p>
            <p className="text-[8px] text-slate-400">CR {settings.crNumber} · {settings.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-black text-orange-600 uppercase tracking-wide">
            Laporan Booking & Riwayat Pembayaran
          </p>
          <p className="text-[10px] font-bold text-slate-700">
            {finance ? 'INTERNAL FINANCE REPORT' : 'CUSTOMER PAYMENT REPORT'}
          </p>
          {finance && (
            <p className="mt-1 inline-flex items-center gap-1 text-[8px] font-black text-rose-700 border border-rose-400 bg-rose-50 px-1.5 py-0.5 rounded">
              <Lock className="w-2.5 h-2.5" /> RAHASIA PERUSAHAAN
            </p>
          )}
          <p className="text-[8px] text-slate-400 mt-1">Dicetak {new Date().toLocaleString('id-ID')}</p>
        </div>
      </div>

      {/* ===== Filter meta + KPI ===== */}
      <div className="mt-3 flex items-center gap-2 text-[8.5px] text-slate-500">
        <CalendarDays className="w-3 h-3 text-emerald-600" />
        <span>Filter: {filterMeta}</span>
        <span className="ml-auto font-bold text-slate-700">{bookings.length} booking</span>
      </div>

      <div className={`mt-2 grid gap-1.5 ${finance ? 'grid-cols-6' : 'grid-cols-4'}`}>
        <div className="border-2 border-emerald-500 bg-emerald-50 rounded px-2 py-1.5 text-center">
          <p className="text-[7.5px] font-black text-emerald-700 uppercase">Total Tagihan</p>
          <p className="text-[11px] font-black text-emerald-800">{sar(totals.sell)}</p>
          <p className="text-[8px] text-emerald-600">
            {finance ? idr(totals.sellIDR) : 'Nilai invoice dalam SAR'}
          </p>
        </div>
        <div className="border-2 border-blue-500 bg-blue-50 rounded px-2 py-1.5 text-center">
          <p className="text-[7.5px] font-black text-blue-700 uppercase">Total Diterima</p>
          <p className="text-[11px] font-black text-blue-800">{sar(totals.paid)}</p>
          <p className="text-[8px] text-blue-600">{idr(totals.paidIDR)}</p>
        </div>
        <div className={`border-2 rounded px-2 py-1.5 text-center ${balance > 0.5 ? 'border-rose-500 bg-rose-50' : 'border-emerald-500 bg-emerald-50'}`}>
          <p className={`text-[7.5px] font-black uppercase ${balance > 0.5 ? 'text-rose-700' : 'text-emerald-700'}`}>
            {balance > 0.5 ? 'Sisa Tagihan' : 'Balance Deposit'}
          </p>
          <p className={`text-[11px] font-black ${balance > 0.5 ? 'text-rose-700' : 'text-emerald-700'}`}>{sar(Math.abs(balance))}</p>
          <p className="text-[8px] text-slate-500">
            {finance
              ? idr(Math.abs(totals.sellIDR - totals.paidIDR))
              : 'Outstanding / deposit dalam SAR'}
          </p>
        </div>
        {!finance && (
          <div className="border-2 border-indigo-400 bg-indigo-50 rounded px-2 py-1.5 text-center">
            <p className="text-[7.5px] font-black text-indigo-700 uppercase">Average Exchange Rate</p>
            <p className="text-[11px] font-black text-indigo-800">
              1 SAR = {averageRate.toLocaleString('id-ID')} IDR
            </p>
            <p className="text-[8px] text-indigo-600">Weighted invoice transaction history</p>
          </div>
        )}
        {finance && (
          <>
            <div className="border-2 border-rose-400 bg-rose-50 rounded px-2 py-1.5 text-center">
              <p className="text-[7.5px] font-black text-rose-700 uppercase">Modal Vendor</p>
              <p className="text-[11px] font-black text-rose-800">{sar(totals.cost)}</p>
            </div>
            <div className="border-2 border-amber-500 bg-amber-50 rounded px-2 py-1.5 text-center">
              <p className="text-[7.5px] font-black text-amber-700 uppercase">Net Profit</p>
              <p className="text-[11px] font-black text-amber-800">{sar(profit)}</p>
            </div>
            <div className="border-2 border-indigo-500 bg-indigo-50 rounded px-2 py-1.5 text-center">
              <p className="text-[7.5px] font-black text-indigo-700 uppercase">Margin · Vendor Paid</p>
              <p className="text-[11px] font-black text-indigo-800">{margin.toFixed(1)}% · {sar(totals.vendor)}</p>
            </div>
          </>
        )}
      </div>

      {!finance && (
        <div className="mt-2 border border-orange-300 bg-orange-50 px-3 py-1.5 text-[8px] font-bold text-orange-800">
          CATATAN KURS: Equivalent in IDR memakai weighted average rate seluruh history transaksi invoice ({averageRate.toLocaleString('id-ID')} IDR/SAR). Konversi menyesuaikan kurs yang berlaku saat transaksi dilakukan.
        </div>
      )}

      {/* ===== Per-booking blocks ===== */}
      {bookings.map((b, idx) => {
        const custPay = resolvePaymentHistory(b);
        const vendPay = finance ? resolveVendorPayments(b) : [];
        const bBal = b.totalSellSAR - b.amountPaidSAR;
        const bookingAverageRate = averageTransactionRate(
          b.paymentHistory,
          b.exchangeRate || settings.defaultExchangeRateSARtoIDR
        );
        return (
          <div key={b.id} className="mt-4 border border-slate-200 rounded overflow-hidden" style={{ breakInside: 'avoid' }}>
            {/* block header */}
            <div className="bg-slate-900 text-white px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9px]">
              <span className="font-black text-orange-400">#{idx + 1} · {b.bookingRef}</span>
              <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" />{b.bookingType === 'Group' ? b.travelCompany || b.customerName : b.customerName}</span>
              <span className="flex items-center gap-1"><Building2 className="w-2.5 h-2.5" />{b.hotelName} ({b.hotelCity})</span>
              <span>{b.checkInDate} → {b.checkOutDate} · {b.totalNights}N</span>
              {b.hcnRsvp && <span className="font-mono text-indigo-300">{b.hcnRsvp}</span>}
              <span className={`ml-auto px-1.5 py-0.5 rounded text-[7.5px] font-black border ${statusPill[b.status] || statusPill.Draft}`}>
                {b.status.toUpperCase()}
              </span>
            </div>

            {/* financial row */}
            <div className="grid grid-cols-4 bg-slate-50 px-3 py-1.5 text-[8.5px] border-b border-slate-200">
              <span>
                Tagihan: <b className="text-slate-900">{sar(b.totalSellSAR)}</b>
                {finance && <span className="text-slate-400"> ({idr(b.totalSellIDR)})</span>}
              </span>
              <span className="text-emerald-700">Diterima: <b>{sar(b.amountPaidSAR)}</b></span>
              <span className={bBal > 0.5 ? 'text-rose-600' : 'text-emerald-700'}>
                {bBal > 0.5 ? 'Sisa' : 'Deposit'}: <b>{sar(Math.abs(bBal))}</b>
              </span>
              {finance ? (
                <span className="text-amber-700">
                  Modal {sar(b.totalCostSAR)} · Profit <b>{sar(b.profitSAR)}</b> ({b.profitMarginPercent.toFixed(1)}%)
                </span>
              ) : (
                <span className="text-indigo-700 font-bold">
                  Avg Rate: 1 SAR = {bookingAverageRate.toLocaleString('id-ID')} IDR
                </span>
              )}
            </div>

            {/* customer payment history */}
            <div className="px-3 pt-2">
              <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                <Wallet className="w-2.5 h-2.5" /> Riwayat Pembayaran Customer ({custPay.length} termin)
              </p>
              {custPay.length === 0 ? (
                <p className="text-[8.5px] italic text-slate-400 pb-1">Belum ada pembayaran tercatat.</p>
              ) : (
                <table className="w-full border border-slate-200 mb-1">
                  <thead>
                    <tr>
                      <th className={th}>#</th><th className={th}>Tanggal</th><th className={th}>Metode</th>
                      <th className={th}>Referensi</th><th className={`${th} text-right`}>Kurs</th>
                      <th className={`${th} text-right`}>SAR</th><th className={`${th} text-right`}>IDR</th><th className={th}>Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custPay.map((p, i) => (
                      <tr key={p.id}>
                        <td className={td}>{i + 1}</td>
                        <td className={td}>{new Date(p.date).toLocaleDateString('id-ID')}</td>
                        <td className={td}>{p.method}</td>
                        <td className={`${td} font-mono`}>{p.reference || '-'}</td>
                        <td className={`${td} text-right`}>{p.exchangeRate ? Math.round(p.exchangeRate).toLocaleString('id-ID') : '-'}</td>
                        <td className={`${td} text-right font-bold`}>{(Math.round(p.amountSAR * 100) / 100).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
                        <td className={`${td} text-right font-bold text-emerald-700`}>{Math.round(p.amountIDR).toLocaleString('id-ID')}</td>
                        <td className={`${td} text-slate-500`}>{p.note || '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-emerald-50">
                      <td colSpan={5} className="px-2 py-1 text-[8.5px] font-black text-emerald-800 text-right">TOTAL DITERIMA</td>
                      <td className="px-2 py-1 text-[9px] font-black text-emerald-800 text-right">{sar(b.amountPaidSAR).replace('SAR ', '')}</td>
                      <td className="px-2 py-1 text-[9px] font-black text-emerald-800 text-right">{Math.round(b.amountPaidIDR).toLocaleString('id-ID')}</td>
                      <td className={td}></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* vendor payment history — finance only */}
            {finance && (
              <div className="px-3 pb-2">
                <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-rose-700 mb-1">
                  <CreditCard className="w-2.5 h-2.5" /> Pembayaran ke Vendor · {b.vendorName || '-'} ({vendPay.length})
                </p>
                {vendPay.length === 0 ? (
                  <p className="text-[8.5px] italic text-slate-400">Belum ada pembayaran vendor.</p>
                ) : (
                  <table className="w-full border border-slate-200">
                    <thead>
                      <tr>
                        <th className={`${th} bg-rose-900`}>#</th><th className={`${th} bg-rose-900`}>Tanggal</th>
                        <th className={`${th} bg-rose-900`}>Metode</th><th className={`${th} bg-rose-900`}>Referensi</th>
                        <th className={`${th} bg-rose-900 text-right`}>Kurs</th><th className={`${th} bg-rose-900 text-right`}>SAR</th>
                        <th className={`${th} bg-rose-900 text-right`}>IDR</th><th className={`${th} bg-rose-900`}>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendPay.map((p, i) => (
                        <tr key={p.id} className="bg-rose-50/40">
                          <td className={td}>{i + 1}</td>
                          <td className={td}>{new Date(p.date).toLocaleDateString('id-ID')}</td>
                          <td className={td}>{p.method}</td>
                          <td className={`${td} font-mono`}>{p.reference || '-'}</td>
                          <td className={`${td} text-right`}>{p.exchangeRate ? Math.round(p.exchangeRate).toLocaleString('id-ID') : '-'}</td>
                          <td className={`${td} text-right font-bold`}>{(Math.round(p.amountSAR * 100) / 100).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
                          <td className={`${td} text-right font-bold text-rose-700`}>{Math.round(p.amountIDR).toLocaleString('id-ID')}</td>
                          <td className={`${td} text-slate-500`}>{p.note || '-'}</td>
                        </tr>
                      ))}
                      <tr className="bg-rose-50">
                        <td colSpan={5} className="px-2 py-1 text-[8.5px] font-black text-rose-800 text-right">TOTAL KE VENDOR</td>
                        <td className="px-2 py-1 text-[9px] font-black text-rose-800 text-right">
                          {Math.round(vendPay.reduce((s, p) => s + p.amountSAR, 0)).toLocaleString('id-ID')}
                        </td>
                        <td className="px-2 py-1 text-[9px] font-black text-rose-800 text-right">
                          {Math.round(vendPay.reduce((s, p) => s + p.amountIDR, 0)).toLocaleString('id-ID')}
                        </td>
                        <td className={td}></td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ===== TOTAL AKUMULASI — bold accumulation band ===== */}
      <div className="mt-4 rounded overflow-hidden border-2 border-slate-900">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">
            Total Akumulasi · {bookings.length} Booking
          </span>
          <span className="text-[9px] font-bold opacity-90">{filterMeta}</span>
        </div>
        <div className={`grid ${finance ? 'grid-cols-6' : 'grid-cols-4'} divide-x divide-slate-200 text-center bg-white`}>
          <div className="px-3 py-2.5">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Total Tagihan</p>
            <p className="text-[15px] font-black text-slate-900 leading-tight">{sar(totals.sell)}</p>
            <p className="text-[9px] font-bold text-slate-500">
              {finance ? idr(totals.sellIDR) : 'Customer invoice · SAR'}
            </p>
          </div>
          <div className="px-3 py-2.5 bg-emerald-50/60">
            <p className="text-[8px] font-black text-emerald-700 uppercase tracking-wider">Total Diterima</p>
            <p className="text-[15px] font-black text-emerald-700 leading-tight">{sar(totals.paid)}</p>
            <p className="text-[9px] font-bold text-emerald-600">{idr(totals.paidIDR)}</p>
          </div>
          <div className={`px-3 py-2.5 ${balance > 0.5 ? 'bg-rose-50/60' : 'bg-teal-50/60'}`}>
            <p className={`text-[8px] font-black uppercase tracking-wider ${balance > 0.5 ? 'text-rose-700' : 'text-teal-700'}`}>
              {balance > 0.5 ? 'Outstanding' : 'Balance Deposit'}
            </p>
            <p className={`text-[15px] font-black leading-tight ${balance > 0.5 ? 'text-rose-700' : 'text-teal-700'}`}>
              {sar(Math.abs(balance))}
            </p>
            <p className={`text-[9px] font-bold ${balance > 0.5 ? 'text-rose-600' : 'text-teal-600'}`}>
              {finance
                ? idr(Math.abs(totals.sellIDR - totals.paidIDR))
                : 'Balance / deposit · SAR'}
            </p>
          </div>
          {finance && (
            <div className="px-3 py-2.5 bg-rose-50/60">
              <p className="text-[8px] font-black text-rose-700 uppercase tracking-wider">Modal Vendor</p>
              <p className="text-[15px] font-black text-rose-800 leading-tight">{sar(totals.cost)}</p>
              <p className="text-[9px] font-bold text-rose-600">Vendor paid {sar(totals.vendor)}</p>
            </div>
          )}
          {finance ? (
            <div className="px-3 py-2.5 bg-amber-50/60">
              <p className="text-[8px] font-black uppercase tracking-wider text-amber-700">Net Profit</p>
              <p className="text-[15px] font-black leading-tight text-amber-800">{sar(profit)}</p>
              <p className="text-[9px] font-bold text-amber-600">{margin.toFixed(1)}% margin</p>
            </div>
          ) : (
            <div className="px-3 py-2.5 bg-indigo-50/60">
              <p className="text-[8px] font-black uppercase tracking-wider text-indigo-700">Average SAR Rate</p>
              <p className="text-[15px] font-black leading-tight text-indigo-800">
                1 SAR = {averageRate.toLocaleString('id-ID')}
              </p>
              <p className="text-[9px] font-bold text-indigo-600">IDR · transaction history</p>
            </div>
          )}
          {finance && (
            <div className="px-3 py-2.5 bg-slate-900">
              <p className="text-[8px] font-black text-slate-300 uppercase tracking-wider">Cash Position</p>
              <p className="text-[15px] font-black text-emerald-400 leading-tight">{sar(totals.paid - totals.vendor)}</p>
              <p className="text-[9px] font-bold text-slate-400">diterima − vendor</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== Footer ===== */}
      <div className="mt-5 pt-3 border-t-2 border-slate-800 flex justify-between items-end text-[8.5px] text-slate-500">
        <div>
          <p className="font-bold text-slate-700">{legal}</p>
          <p>{settings.address}</p>
          <p className="italic mt-1">
            {finance
              ? 'Dokumen internal — data vendor & profit bersifat rahasia, tidak untuk disebarluaskan.'
              : 'Dokumen customer — hanya ringkasan booking & pembayaran. Terima kasih atas kepercayaan Anda.'}
          </p>
        </div>
        <div className="text-center">
          <p>Hormat kami,</p>
          <div className="h-10" />
          <p className="font-black text-slate-800">( {(settings.bookingManagerName || 'GHOFAR').toUpperCase()} )</p>
          <p>{settings.bookingManagerRole || 'Booking Manager'}</p>
        </div>
      </div>
    </div>
  );
};

export default ReportPDFDocument;
