import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Search,
  CalendarDays,
  Hotel,
  User,
  Filter,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Wallet,
  AlertCircle,
  Receipt,
  Loader2,
  History,
  CreditCard,
} from 'lucide-react';
import { Booking, CompanySettings } from '../types/booking';
import { formatSAR, formatIDR } from '../utils/currency';
import {
  exportVoucherToPDF,
  resolvePaymentHistory,
  resolveVendorPayments,
  exportLandscapePagesPDF,
  exportStatementBookingCustomer,
} from '../utils/export';
import { exportMasterWorkbookFull } from '../utils/masterExport';
import { ReportPDFDocument } from './ReportPDFDocument';
import { FileText, Lock, Users, Database, Building2 } from 'lucide-react';

interface ReportsProps {
  bookings: Booking[];
  settings: CompanySettings;
  onViewVoucher: (b: Booking) => void;
}

const idNum = (n: number, d = 0) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);

const statusStyles: Record<string, string> = {
  Paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Partial: 'bg-amber-100 text-amber-800 border-amber-300',
  Unpaid: 'bg-rose-100 text-rose-800 border-rose-300',
  Draft: 'bg-slate-100 text-slate-700 border-slate-300',
  Cancelled: 'bg-gray-200 text-gray-600 border-gray-300',
};

export const Reports: React.FC<ReportsProps> = ({ bookings, settings, onViewVoucher }) => {
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(today);
  const [hotelFilter, setHotelFilter] = useState('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'import' | 'manual'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportPdfMsg, setReportPdfMsg] = useState<string | null>(null);
  const [historyPdfKind, setHistoryPdfKind] = useState<'cust' | 'fin' | null>(null);

  const customerFilterMeta = `Periode ${fromDate || 'awal'} → ${toDate || 'hari ini'} · Hotel: ${
    hotelFilter === 'ALL' ? 'Semua' : hotelFilter
  } · Status: ${statusFilter === 'ALL' ? 'Semua' : statusFilter}`;
  const internalFilterMeta = `${customerFilterMeta} · Vendor: ${
    vendorFilter === 'ALL' ? 'Semua' : vendorFilter
  }`;

  const handleHistoryPDF = async (kind: 'cust' | 'fin') => {
    setHistoryPdfKind(kind);
    setReportPdfMsg(null);
    // wait a frame so the offscreen document paints before capture
    await new Promise((r) => setTimeout(r, 60));
    const id = kind === 'cust' ? 'report-pdf-customer' : 'report-pdf-finance';
    const filename = `TAMIMA_${kind === 'cust' ? 'Customer' : 'Internal'}_Report_${today}`;
    const ok =
      kind === 'cust'
        ? await exportVoucherToPDF(id, filename)
        : await exportLandscapePagesPDF(id, filename);
    setHistoryPdfKind(null);
    setReportPdfMsg(ok ? `PDF ${kind === 'cust' ? 'Customer' : 'Finance'} + riwayat pembayaran tersimpan ✓` : 'Gagal membuat PDF — coba lagi');
    setTimeout(() => setReportPdfMsg(null), 2500);
  };


  const hotelOptions = useMemo(() => Array.from(new Set(bookings.map((b) => b.hotelName))).sort(), [bookings]);
  const vendorOptions = useMemo(
    () => Array.from(new Set(bookings.map((b) => b.vendorName).filter(Boolean) as string[])).sort(),
    [bookings]
  );

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => {
        if (fromDate && b.checkInDate < fromDate) return false;
        if (toDate && b.checkInDate > toDate) return false;
        if (hotelFilter !== 'ALL' && b.hotelName !== hotelFilter) return false;
        if (vendorFilter !== 'ALL' && b.vendorName !== vendorFilter) return false;
        if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
        if (sourceFilter === 'import' && b.source !== 'import') return false;
        if (sourceFilter === 'manual' && b.source === 'import') return false;
        if (searchTerm.trim()) {
          const t = searchTerm.toLowerCase();
          if (
            !b.customerName.toLowerCase().includes(t) &&
            !b.bookingRef.toLowerCase().includes(t) &&
            !b.customerPhone.toLowerCase().includes(t)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  }, [bookings, fromDate, toDate, hotelFilter, vendorFilter, statusFilter, sourceFilter, searchTerm]);

  // KPI aggregation
  const kpi = useMemo(() => {
    const revenue = filtered.reduce((s, b) => s + b.totalSellSAR, 0);
    const cost = filtered.reduce((s, b) => s + b.totalCostSAR, 0);
    const collected = filtered.reduce((s, b) => s + b.amountPaidSAR, 0);
    const outstanding = filtered.reduce((s, b) => s + (b.totalSellSAR - b.amountPaidSAR), 0);
    const profit = filtered.reduce((s, b) => s + b.profitSAR, 0);
    const payments = filtered.reduce((s, b) => s + resolvePaymentHistory(b).length, 0);
    return { revenue, cost, collected, outstanding, profit, payments };
  }, [filtered]);

  const inputCls =
    'w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500';

  return (
    <div className="space-y-6 pb-16">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-2 bg-orange-500 text-white rounded-xl shadow">
              <BarChart3 className="w-5 h-5" />
            </span>
            Booking Tracker & Payment Report
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track bookings & payment history by date, hotel, customer and payment status
          </p>
        </div>

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Export mengikuti filter aktif
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-3 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Filter className="w-4 h-4 text-orange-500" />
          <span>Report Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> CHECK-IN FROM
            </label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> CHECK-IN TO
            </label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Hotel className="w-3 h-3" /> HOTEL
            </label>
            <select value={hotelFilter} onChange={(e) => setHotelFilter(e.target.value)} className={inputCls}>
              <option value="ALL">All Hotels</option>
              {hotelOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-rose-500" /> VENDOR / SUPPLIER
            </label>
            <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className={inputCls}>
              <option value="ALL">All Vendors</option>
              {vendorOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <User className="w-3 h-3" /> CUSTOMER / INVOICE REF
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name / ref / phone..."
                className={`${inputCls} pl-8`}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">PAYMENT STATUS</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
              <option value="ALL">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Draft">Draft</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Data source filter */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Database className="w-3 h-3 text-orange-500" /> Sumber Data:
          </span>
          {(
            [
              { k: 'ALL', label: 'Semua' },
              { k: 'import', label: 'Import Excel' },
              { k: 'manual', label: 'Input Manual' },
            ] as const
          ).map((s) => (
            <button
              key={s.k}
              onClick={() => setSourceFilter(s.k)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                sourceFilter === s.k
                  ? 'bg-slate-900 dark:bg-orange-500 text-white border-slate-900 dark:border-orange-500 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-orange-400'
              }`}
            >
              {s.label}
            </button>
          ))}
          <span className="text-[10px] text-slate-400 ml-auto">
            {filtered.filter((b) => b.source === 'import').length} import · {filtered.filter((b) => b.source !== 'import').length} manual
          </span>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-wider">
            <Receipt className="w-3.5 h-3.5 text-orange-500" /> Bookings
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{filtered.length}</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5 text-orange-400" /> Revenue
          </div>
          <p className="text-lg font-black text-white mt-1">{formatSAR(kpi.revenue)}</p>
          <p className="text-[10px] text-slate-400">{formatIDR(Math.round(kpi.revenue * (settings.defaultExchangeRateSARtoIDR || 4250)))}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border-2 border-emerald-300 dark:border-emerald-800 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
            <Wallet className="w-3.5 h-3.5" /> Collected
          </div>
          <p className="text-lg font-black text-emerald-700 mt-1">{formatSAR(kpi.collected)}</p>
          <p className="text-[10px] text-emerald-600">{kpi.payments} payment record(s)</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border-2 border-rose-300 dark:border-rose-900 shadow-sm">
          <div className="flex items-center gap-2 text-rose-700 text-[10px] font-black uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5" /> Outstanding
          </div>
          <p className="text-lg font-black text-rose-600 mt-1">{formatSAR(kpi.outstanding)}</p>
        </div>
        <div className="bg-orange-500 rounded-xl p-4 border border-orange-600 shadow-sm">
          <div className="flex items-center gap-2 text-orange-100 text-[10px] font-black uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" /> Net Profit
          </div>
          <p className="text-lg font-black text-white mt-1">{formatSAR(kpi.profit)}</p>
        </div>
      </div>

      {/* ===== SIMPLIFIED EXPORT CENTER ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer documents: safe, no internal financial data */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-orange-300 dark:border-orange-800 shadow-sm overflow-hidden">
          <div className="bg-orange-500 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <div>
                <h3 className="font-black text-sm tracking-wide">DOKUMEN CUSTOMER</h3>
                <p className="text-[10px] text-orange-100">Booking, pembayaran, balance SAR, dan average transaction rate</p>
              </div>
            </div>
            <span className="text-[9px] font-black bg-white/20 border border-white/40 px-2 py-0.5 rounded">CUSTOMER SAFE</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => exportStatementBookingCustomer(filtered, settings, `TAMIMA_Statement_Customer_${today}`)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition-colors"
              title="Excel customer: booking, termin pembayaran, balance SAR, average rate"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Customer Excel</span>
            </button>
            <button
              onClick={() => handleHistoryPDF('cust')}
              disabled={historyPdfKind === 'cust'}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors disabled:opacity-50"
              title="PDF portrait customer dengan riwayat pembayaran, tanpa data internal"
            >
              {historyPdfKind === 'cust' ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> : <FileText className="w-4 h-4 text-teal-400" />}
              <span>Customer PDF</span>
            </button>
            <p className="sm:col-span-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Aman dibagikan: tidak memuat HPP, vendor payment, profit, margin, atau catatan internal. PDF memakai portrait A4; Excel disiapkan landscape.
            </p>
          </div>
        </div>

        {/* Internal office documents */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-800 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="font-black text-sm tracking-wide">INTERNAL OFFICE</h3>
                <p className="text-[10px] text-slate-400">HPP, SELL, profit, margin, dan pembayaran vendor</p>
              </div>
            </div>
            <span className="text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/50 px-2 py-0.5 rounded">CONFIDENTIAL</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => exportMasterWorkbookFull(filtered)}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition-colors"
              title="Workbook internal lengkap dari canonical database"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Internal XLSX</span>
            </button>
            <button
              onClick={() => handleHistoryPDF('fin')}
              disabled={historyPdfKind === 'fin'}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors disabled:opacity-50"
              title="PDF internal landscape: HPP, profit, customer & vendor history"
            >
              {historyPdfKind === 'fin' ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> : <FileText className="w-4 h-4 text-rose-400" />}
              <span>Internal PDF</span>
            </button>
            <p className="sm:col-span-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Rahasia perusahaan. PDF disusun landscape dengan margin 5 mm dan pagination otomatis; XLSX berisi sheet summary, BUY, SELL, profitability, audit, dan README.
            </p>
          </div>
        </div>
      </div>

      {/* Printable Report Document */}
      <div
        id="booking-report-document"
        className="bg-white text-slate-900 rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        {/* Report letterhead */}
        <div className="px-6 pt-6 pb-4 border-b-4 border-orange-500 flex justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="logo" className="h-12 max-w-[130px] object-contain" />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-orange-500 text-white flex items-center justify-center font-black text-lg">
                T
              </div>
            )}
            <div>
              <p className="text-[9px] font-black tracking-widest text-orange-600 uppercase">Booking Tracker Report</p>
              <h3 className="text-xl font-black text-slate-900">{settings.legalEntityName || settings.companyName}</h3>
              <p className="text-[10px] text-slate-500 italic">{settings.tagline}</p>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-600">
            <p>
              Generated: <b>{new Date().toLocaleString('en-GB')}</b>
            </p>
            <p>
              Period:{' '}
              <b>
                {fromDate || '—'} → {toDate || 'All'}
              </b>
            </p>
            <p>
              Filter: <b>{hotelFilter === 'ALL' ? 'All Hotels' : hotelFilter}</b> · <b>{statusFilter === 'ALL' ? 'All Status' : statusFilter}</b>
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-slate-700">
            <thead>
              <tr className="bg-slate-900 text-white text-[9.5px] font-black tracking-wider uppercase">
                <th className="px-3 py-2.5 text-left w-6"></th>
                <th className="px-3 py-2.5 text-left">Check-In</th>
                <th className="px-3 py-2.5 text-left">Invoice Ref</th>
                <th className="px-3 py-2.5 text-left">Customer</th>
                <th className="px-3 py-2.5 text-left">Hotel</th>
                <th className="px-3 py-2.5 text-right">Sell (SAR)</th>
                <th className="px-3 py-2.5 text-right text-rose-300">HPP / Buy</th>
                <th className="px-3 py-2.5 text-right">Paid (SAR)</th>
                <th className="px-3 py-2.5 text-right">Balance (SAR)</th>
                <th className="px-3 py-2.5 text-right">Profit (SAR)</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-400 font-semibold">
                    No bookings match the selected filters.
                  </td>
                </tr>
              )}
              {filtered.map((b, i) => {
                const balance = b.totalSellSAR - b.amountPaidSAR;
                const history = resolvePaymentHistory(b);
                const expanded = expandedId === b.id;
                return (
                  <React.Fragment key={b.id}>
                    <tr
                      className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-orange-50/60 cursor-pointer transition-colors`}
                      onClick={() => setExpandedId(expanded ? null : b.id)}
                    >
                      <td className="px-3 py-2.5 text-slate-400">
                        {expanded ? <ChevronDown className="w-4 h-4 text-orange-500" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">{b.checkInDate}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-orange-600">{b.bookingRef}</span>
                        {b.source === 'import' && (
                          <span className="ml-1 text-[8px] font-black bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800 px-1 py-0.5 rounded align-middle">
                            IMP
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {b.bookingType === 'Group' && b.travelCompany ? (
                          <>
                            <p className="font-bold text-slate-900 flex items-center gap-1">
                              {b.travelCompany}
                              <span className="text-[8px] font-black bg-orange-100 text-orange-700 border border-orange-300 px-1 py-0.5 rounded">GROUP</span>
                            </p>
                            <p className="text-[9.5px] text-slate-400">c/o {b.customerName}</p>
                          </>
                        ) : (
                          <p className="font-bold text-slate-900">{b.customerName}</p>
                        )}
                        <p className="text-[9.5px] text-slate-400">{b.customerPhone}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                          {b.hotelName}
                          {b.hotelTransfer && (
                            <span className="ml-1 text-[8px] font-black bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 px-1 py-0.5 rounded align-middle">
                              ⇄ {b.hotelTransfer.type === 'client-upgrade' ? 'UPGRADE' : 'TRANSFER'}
                            </span>
                          )}
                        </p>
                        {b.hotelTransfer && (
                          <p className="text-[9px] text-sky-600 dark:text-sky-400 font-semibold line-clamp-1">
                            dari {b.hotelTransfer.fromHotel}
                          </p>
                        )}
                        {b.vendorName && (
                          <p className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold line-clamp-1">Vendor: {b.vendorName}</p>
                        )}
                        <p className="text-[9.5px] text-slate-400">{b.hotelCity}</p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                        {idNum(b.totalSellSAR)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-rose-600 whitespace-nowrap">
                        {idNum(b.totalCostSAR)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {idNum(b.amountPaidSAR)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-black whitespace-nowrap ${balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}
                      >
                        {idNum(balance)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-orange-600 whitespace-nowrap">
                        {idNum(b.profitSAR)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black border ${statusStyles[b.status] || ''}`}
                        >
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-slate-100/80 dark:bg-slate-800/40">
                        <td colSpan={11} className="px-4 sm:px-6 py-3 overflow-x-auto no-scrollbar">
                          <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <History className="w-3.5 h-3.5 text-orange-500" />
                            Payment History — {b.bookingRef}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewVoucher(b);
                              }}
                              className="ml-auto normal-case tracking-normal text-orange-600 hover:underline font-bold"
                            >
                              Open Confirmation Letter →
                            </button>
                          </div>
                          {history.length === 0 ? (
                            <p className="text-[10.5px] text-slate-400 italic">No payment received yet.</p>
                          ) : (
                            <table className="w-full min-w-[560px] text-[10.5px]">
                              <thead>
                                <tr className="text-slate-500 text-[9px] font-black uppercase">
                                  <th className="text-left py-1 pr-3">#</th>
                                  <th className="text-left py-1 pr-3">Date</th>
                                  <th className="text-left py-1 pr-3">Method</th>
                                  <th className="text-left py-1 pr-3">Reference</th>
                                  <th className="text-right py-1 pr-3">SAR</th>
                                  <th className="text-right py-1 pr-3">IDR</th>
                                  <th className="text-right py-1 pr-3">Rate</th>
                                  <th className="text-left py-1">Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.map((p, idx) => (
                                  <tr key={p.id} className="border-t border-slate-200">
                                    <td className="py-1.5 pr-3 font-black text-orange-600">{idx + 1}</td>
                                    <td className="py-1.5 pr-3 font-semibold">{new Date(p.date).toLocaleDateString('en-GB')}</td>
                                    <td className="py-1.5 pr-3">
                                      <span className="inline-flex items-center gap-1">
                                        <CreditCard className="w-3 h-3 text-slate-400" /> {p.method}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-3 font-mono text-slate-600">{p.reference || '-'}</td>
                                    <td className="py-1.5 pr-3 text-right font-bold text-emerald-700">{idNum(p.amountSAR, 2)}</td>
                                    <td className="py-1.5 pr-3 text-right font-bold text-emerald-700">{idNum(p.amountIDR)}</td>
                                    <td className="py-1.5 pr-3 text-right font-mono text-amber-700">{p.exchangeRate ? idNum(p.exchangeRate) : '-'}</td>
                                    <td className="py-1.5 text-slate-500">{p.note || '-'}</td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 border-slate-300 font-black text-slate-800">
                                  <td colSpan={5} className="py-1.5 text-right">TOTAL CUSTOMER PAID:</td>
                                  <td className="py-1.5 pr-3 text-right text-emerald-700">{idNum(b.amountPaidSAR, 2)}</td>
                                  <td className="py-1.5 pr-3 text-right text-emerald-700">{idNum(b.amountPaidIDR)}</td>
                                  <td></td>
                                  <td></td>
                                </tr>
                              </tbody>
                            </table>
                          )}

                          {/* Vendor payments (internal) */}
                          {(() => {
                            const vp = resolveVendorPayments(b);
                            return (
                              <div className="mt-3">
                                <div className="flex items-center gap-2 mb-1.5 text-[10px] font-black uppercase tracking-wider text-rose-600">
                                  <CreditCard className="w-3.5 h-3.5" />
                                  Pembayaran ke Vendor / Hotel ({vp.length})
                                </div>
                                {vp.length === 0 ? (
                                  <p className="text-[10.5px] text-slate-400 italic">Belum ada pembayaran ke vendor.</p>
                                ) : (
                                  <table className="w-full min-w-[560px] text-[10.5px]">
                                    <thead>
                                      <tr className="text-slate-500 text-[9px] font-black uppercase">
                                        <th className="text-left py-1 pr-3">#</th>
                                        <th className="text-left py-1 pr-3">Date</th>
                                        <th className="text-left py-1 pr-3">Method</th>
                                        <th className="text-left py-1 pr-3">Reference</th>
                                        <th className="text-right py-1 pr-3">SAR</th>
                                        <th className="text-right py-1 pr-3">IDR</th>
                                        <th className="text-right py-1 pr-3">Rate</th>
                                        <th className="text-left py-1">Note</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {vp.map((p, idx) => (
                                        <tr key={p.id} className="border-t border-rose-100 dark:border-rose-900/50">
                                          <td className="py-1.5 pr-3 font-black text-rose-600">{idx + 1}</td>
                                          <td className="py-1.5 pr-3 font-semibold">{new Date(p.date).toLocaleDateString('en-GB')}</td>
                                          <td className="py-1.5 pr-3">{p.method}</td>
                                          <td className="py-1.5 pr-3 font-mono text-slate-600">{p.reference || '-'}</td>
                                          <td className="py-1.5 pr-3 text-right font-bold text-rose-700">{idNum(p.amountSAR, 2)}</td>
                                          <td className="py-1.5 pr-3 text-right font-bold text-rose-700">{idNum(p.amountIDR)}</td>
                                          <td className="py-1.5 pr-3 text-right font-mono text-amber-700">{p.exchangeRate ? idNum(p.exchangeRate) : '-'}</td>
                                          <td className="py-1.5 text-slate-500">{p.note || '-'}</td>
                                        </tr>
                                      ))}
                                      <tr className="border-t-2 border-rose-200 font-black text-slate-800">
                                        <td colSpan={4} className="py-1.5 text-right">TOTAL VENDOR PAID:</td>
                                        <td className="py-1.5 pr-3 text-right text-rose-700">
                                          {idNum(vp.reduce((s, p) => s + p.amountSAR, 0), 2)}
                                        </td>
                                        <td className="py-1.5 pr-3 text-right text-rose-700">
                                          {idNum(vp.reduce((s, p) => s + p.amountIDR, 0))}
                                        </td>
                                        <td colSpan={2}></td>
                                      </tr>
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-sm shadow-lg">
                  <td colSpan={5} className="px-4 py-3 tracking-wider uppercase">
                    Total Akumulasi ({filtered.length} Bookings)
                  </td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{idNum(kpi.revenue)}</td>
                  <td className="px-4 py-3 text-right text-base text-rose-100 tabular-nums">{idNum(kpi.cost)}</td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{idNum(kpi.collected)}</td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{idNum(kpi.outstanding)}</td>
                  <td className="px-4 py-3 text-right text-base tabular-nums">{idNum(kpi.profit)}</td>
                  <td colSpan={5}></td>
                </tr>
                <tr className="bg-slate-900 text-white font-bold text-xs">
                  <td colSpan={5} className="px-4 py-2.5 tracking-wider uppercase">
                    Equivalent in IDR (Est. Rate {idNum(settings.defaultExchangeRateSARtoIDR)})
                  </td>
                  <td colSpan={6} className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">
                    Revenue {formatIDR(Math.round(kpi.revenue * (settings.defaultExchangeRateSARtoIDR || 4250)))} · Outstanding{' '}
                    {formatIDR(Math.round(kpi.outstanding * (settings.defaultExchangeRateSARtoIDR || 4250)))}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Report footer bar */}
        <div className="bg-slate-900 text-white text-center text-[9px] font-bold tracking-widest py-2 px-4">
          {(settings.legalEntityName || settings.companyName).toUpperCase()} · BOOKING TRACKER & PAYMENT REPORT ·{' '}
          {filtered.length} RECORD(S)
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Tip: click any row to expand its payment history. Use “Export Excel” for a 2-sheet workbook (Tracker + Payment History).
      </p>

      {reportPdfMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold text-white border animate-bounce ${
            reportPdfMsg.includes('failed') || reportPdfMsg.includes('Gagal')
              ? 'bg-rose-600 border-rose-400'
              : 'bg-emerald-600 border-emerald-400'
          }`}
        >
          {reportPdfMsg}
        </div>
      )}

      {/* Offscreen printable documents for PDF + payment history export */}
      <div className="fixed -left-[1200px] top-0 pointer-events-none" aria-hidden="true">
        <ReportPDFDocument
          id="report-pdf-customer"
          bookings={filtered}
          settings={settings}
          variant="customer"
          filterMeta={customerFilterMeta}
        />
        <ReportPDFDocument
          id="report-pdf-finance"
          bookings={filtered}
          settings={settings}
          variant="finance"
          filterMeta={internalFilterMeta}
        />
      </div>
    </div>
  );
};

export default Reports;
