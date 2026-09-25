import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  FileSpreadsheet, 
  FileText, 
  Edit3, 
  Copy, 
  Trash2, 
  MessageCircle, 
  Plus,
  CheckCircle2,
  FileUp
} from 'lucide-react';
import { Booking, CompanySettings, PaymentStatus, VisaAction } from '../types/booking';
import { formatSAR, formatIDR, getProfitMarginBadge } from '../utils/currency';
import { exportBookingsToExcel, shareViaWhatsApp } from '../utils/export';
import { VISA_ACTIONS, visaActionStyle, visaReminder } from '../utils/visa';

interface BookingsListProps {
  bookings: Booking[];
  settings: CompanySettings;
  currencyView: 'DUAL' | 'SAR' | 'IDR';
  initialStatusFilter?: string;
  onViewVoucher: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onDuplicateBooking: (booking: Booking) => void;
  onDeleteBooking: (id: string) => void;
  onMarkAsPaid?: (id: string) => void;
  onNewBooking: () => void;
  onOpenImport?: () => void;
  onVisaAction: (id: string, action: VisaAction) => void;
}



export const BookingsList: React.FC<BookingsListProps> = ({
  bookings,
  settings,
  currencyView,
  initialStatusFilter = 'ALL',
  onViewVoucher,
  onEditBooking,
  onDuplicateBooking,
  onDeleteBooking,
  onMarkAsPaid,
  onNewBooking,
  onOpenImport,
  onVisaAction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'checkin' | 'revenue' | 'profit' | 'margin'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter & Sort Logic
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        // Status filter
        if (statusFilter !== 'ALL' && b.status !== statusFilter) {
          return false;
        }

        // City filter
        if (cityFilter !== 'ALL' && b.hotelCity !== cityFilter) {
          return false;
        }

        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchRef = b.bookingRef.toLowerCase().includes(term);
          const matchName = b.customerName.toLowerCase().includes(term);
          const matchPhone = b.customerPhone.toLowerCase().includes(term);
          const matchHotel = b.hotelName.toLowerCase().includes(term);
          const matchPassport = (b.customerPassport || '').toLowerCase().includes(term);
          const matchVendor = (b.vendorName || '').toLowerCase().includes(term);
          const matchHcn = (b.hcnRsvp || '').toLowerCase().includes(term);
          if (!matchRef && !matchName && !matchPhone && !matchHotel && !matchPassport && !matchVendor && !matchHcn) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA: number = 0;
        let valB: number = 0;

        if (sortBy === 'date') {
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
        } else if (sortBy === 'checkin') {
          valA = new Date(a.checkInDate).getTime();
          valB = new Date(b.checkInDate).getTime();
        } else if (sortBy === 'revenue') {
          valA = a.totalSellSAR;
          valB = b.totalSellSAR;
        } else if (sortBy === 'profit') {
          valA = a.profitSAR;
          valB = b.profitSAR;
        } else if (sortBy === 'margin') {
          valA = a.profitMarginPercent;
          valB = b.profitMarginPercent;
        }

        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
  }, [bookings, searchTerm, statusFilter, cityFilter, sortBy, sortOrder]);

  const toggleSort = (type: 'date' | 'checkin' | 'revenue' | 'profit' | 'margin') => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('desc');
    }
  };

  const statusBadges: Record<PaymentStatus, { bg: string; text: string }> = {
    Paid: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', text: 'Fully Paid' },
    Partial: { bg: 'bg-amber-100 text-amber-800 border-amber-300', text: 'Partial Paid' },
    Unpaid: { bg: 'bg-rose-100 text-rose-800 border-rose-300', text: 'Unpaid Invoice' },
    Draft: { bg: 'bg-slate-100 text-slate-700 border-slate-300', text: 'Draft Quote' },
    Cancelled: { bg: 'bg-gray-200 text-gray-600 border-gray-300', text: 'Cancelled' },
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Saved Booking Records</h2>
            <p className="text-xs text-slate-500">
              Showing {filteredBookings.length} of {bookings.length} stored bookings
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenImport && (
              <button
                onClick={onOpenImport}
                className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-3.5 py-2 rounded-xl shadow transition-colors text-xs"
              >
                <FileUp className="w-4 h-4" />
                <span>Import Excel</span>
              </button>
            )}

            <button
              onClick={() => exportBookingsToExcel(filteredBookings)}
              className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-xl transition-colors text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Current ({filteredBookings.length}) to Excel</span>
            </button>

            <button
              onClick={onNewBooking}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl shadow transition-colors text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Booking</span>
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Invoice Ref, Guest Name, WhatsApp, Hotel..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="md:col-span-4 flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs overflow-x-auto">
            {['ALL', 'Paid', 'Partial', 'Unpaid', 'Draft'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-center whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>

          {/* City Filter */}
          <div className="md:col-span-3">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
            >
              <option value="ALL">All Cities (Makkah, Madina, etc.)</option>
              <option value="Makkah">Makkah</option>
              <option value="Madina">Madina</option>
              <option value="Jeddah">Jeddah</option>
              <option value="Riyadh">Riyadh</option>
              <option value="Jakarta">Jakarta</option>
              <option value="Bali">Bali</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Visa reminder phase legend */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> H-31+ On Track</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 alarm-slow" /> H-30…H-16 Apply</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 alarm-mid" /> H-15…H-8 Urgent</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 alarm-fast" /> H-7…H-1 Critical</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 alarm-critical" /> H-0 Check-in</span>
          <span className="ml-auto normal-case font-semibold text-slate-400">Visa approval reminder · H-30 s/d H-0</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-900 text-white uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('date')}>
                  <div className="flex items-center space-x-1">
                    <span>Invoice Ref / Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-3">Customer Info</th>
                <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('checkin')}>
                  <div className="flex items-center space-x-1">
                    <span>Hotel & Stay Dates</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('revenue')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Sell Price</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">
                  <span>HPP / Buy (Cost)</span>
                </th>
                <th className="px-4 py-3 text-right">Paid / Balance</th>
                <th className="px-4 py-3 text-right cursor-pointer" onClick={() => toggleSort('profit')}>
                  <div className="flex items-center justify-end space-x-1">
                    <span>Profit & Margin</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">
                  <span>Visa Reminder</span>
                </th>
                <th className="px-4 py-3 text-center">Action</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    <p className="text-base font-bold text-slate-600">No bookings match your current search/filter</p>
                    <p className="text-xs mt-1">Try resetting search filters or create a new booking.</p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const remSAR = b.totalSellSAR - b.amountPaidSAR;
                  const remIDR = b.totalSellIDR - b.amountPaidIDR;
                  const statusInfo = statusBadges[b.status];
                  const marginBadge = getProfitMarginBadge(b.profitMarginPercent);

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Ref & Created Date */}
                      <td className="px-4 py-3 font-semibold">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm block">
                          {b.bookingRef}
                          {b.source === 'import' && (
                            <span className="ml-1 text-[8px] font-black bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800 px-1 py-0.5 rounded align-middle">
                              IMP
                            </span>
                          )}
                          {b.hcnRsvp && (
                            <span
                              className="ml-1 text-[8px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 px-1 py-0.5 rounded align-middle font-mono"
                              title={`HCN / RSVP: ${b.hcnRsvp}`}
                            >
                              QR
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Customer Info */}
                      <td className="px-4 py-3">
                        {b.bookingType === 'Group' && b.travelCompany ? (
                          <>
                            <div className="flex items-center space-x-1.5">
                              <p className="font-extrabold text-slate-900 line-clamp-1">{b.travelCompany}</p>
                              <span className="text-[8px] font-black bg-orange-100 text-orange-700 border border-orange-300 px-1 py-0.5 rounded">
                                GROUP
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">c/o {b.customerName}</p>
                          </>
                        ) : (
                          <div className="flex items-center space-x-1.5">
                            <p className="font-extrabold text-slate-900">{b.customerName}</p>
                            <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300 px-1 py-0.5 rounded">
                              PRIV
                            </span>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <span>{b.customerPhone}</span>
                          <span className="text-slate-300">•</span>
                          <span>{b.customerCountry}</span>
                        </p>
                      </td>

                      {/* Hotel & Stay */}
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800 line-clamp-1">
                          {b.hotelName}
                          {b.hotelTransfer && (
                            <span
                              className="ml-1 text-[8px] font-black bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 px-1 py-0.5 rounded align-middle"
                              title={`${b.hotelTransfer.fromHotel} → ${b.hotelTransfer.toHotel}`}
                            >
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
                          <p className="text-[10px] text-rose-600 font-semibold line-clamp-1">
                            Vendor: {b.vendorName}
                            {b.vendorPic ? ` · PIC ${b.vendorPic}` : ''}
                          </p>
                        )}
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          {b.hotelCity} • {b.checkInDate} to {b.checkOutDate} ({b.totalNights}N)
                        </p>
                      </td>

                      {/* Selling Price */}
                      <td className="px-4 py-3 text-right">
                        {currencyView !== 'IDR' && (
                          <p className="font-black text-slate-900 text-xs">{formatSAR(b.totalSellSAR)}</p>
                        )}
                        {currencyView !== 'SAR' && (
                          <p className="text-[11px] font-bold text-slate-500">{formatIDR(b.totalSellIDR)}</p>
                        )}
                      </td>

                      {/* HPP / Buy Cost */}
                      <td className="px-4 py-3 text-right">
                        {currencyView !== 'IDR' && (
                          <p className="font-semibold text-rose-700 text-xs">{formatSAR(b.totalCostSAR)}</p>
                        )}
                        {currencyView !== 'SAR' && (
                          <p className="text-[11px] font-semibold text-rose-600/80">{formatIDR(b.totalCostIDR)}</p>
                        )}
                      </td>

                      {/* Paid / Balance */}
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-emerald-600">
                          Paid: {currencyView === 'IDR' ? formatIDR(b.amountPaidIDR) : formatSAR(b.amountPaidSAR)}
                        </p>
                        {remSAR > 0 ? (
                          <p className="text-[11px] font-bold text-rose-600">
                            Rem: {currencyView === 'IDR' ? formatIDR(remIDR) : formatSAR(remSAR)}
                          </p>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-bold">Settled</span>
                        )}
                      </td>

                      {/* Profit & Margin */}
                      <td className="px-4 py-3 text-right">
                        <p className="font-black text-emerald-800">
                          +{currencyView === 'IDR' ? formatIDR(b.profitIDR) : formatSAR(b.profitSAR)}
                        </p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${marginBadge.bgClass}`}>
                          {b.profitMarginPercent.toFixed(1)}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusInfo.bg}`}
                        >
                          {statusInfo.text}
                        </span>
                      </td>

                      {/* Visa Reminder — phased blinking alarm */}
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const r = visaReminder(b);
                          return (
                            <span
                              className={`inline-block px-2 py-1 rounded-lg text-[9.5px] font-black tracking-wide border ${r.cls} ${r.anim}`}
                            >
                              {r.txt}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Visa workflow action */}
                      <td className="px-4 py-3 text-center">
                        <select
                          value={b.visaAction || ''}
                          onChange={(e) => onVisaAction(b.id, e.target.value as VisaAction)}
                          className={`px-1.5 py-1 rounded-lg border text-[9.5px] font-black cursor-pointer transition-colors ${
                            b.visaAction ? visaActionStyle[b.visaAction] : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          <option value="">— Action —</option>
                          {VISA_ACTIONS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* View Voucher */}
                          <button
                            onClick={() => onViewVoucher(b)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="View / Print Voucher Confirmation Letter"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* WhatsApp Share */}
                          <button
                            onClick={() => shareViaWhatsApp(b, settings)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Send WhatsApp Message"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-600" />
                          </button>

                          {/* Mark Paid */}
                          {onMarkAsPaid && b.status !== 'Paid' && (
                            <button
                              onClick={() => onMarkAsPaid(b.id)}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Mark as Fully Paid"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </button>
                          )}

                          {/* Edit */}
                          <button
                            onClick={() => onEditBooking(b)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Booking"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Duplicate */}
                          <button
                            onClick={() => onDuplicateBooking(b)}
                            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Duplicate Booking"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (confirm(`Delete booking ref ${b.bookingRef}?`)) {
                                onDeleteBooking(b.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Booking"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
