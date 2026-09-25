import React, { useEffect, useState } from 'react';
import { MultiFormatWriter, BarcodeFormat, EncodeHintType } from '@zxing/library';
import JsBarcode from 'jsbarcode';
import {
  MapPin,
  Phone,
  Users,
  Building2,
  BedDouble,
  Car,
  ClipboardList,
  AlertTriangle,
  CreditCard,
  CalendarDays,
} from 'lucide-react';
import { Booking, CompanySettings } from '../types/booking';
import { RiyalIcon } from './RiyalIcon';
import { averageTransactionRate } from '../utils/exchangeRate';

interface VoucherDocumentProps {
  booking: Booking;
  settings: CompanySettings;
  documentId?: string;
}

/* Indonesian-style number formatting to match reference voucher (dot thousands, comma decimals) */
const idNum = (n: number, decimals = 0) =>
  new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n || 0);

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const mealCode: Record<string, string> = {
  'Room Only': 'RO',
  Breakfast: 'BB',
  'Half Board': 'HB',
  'Full Board': 'FB',
};

export const VoucherDocument: React.FC<VoucherDocumentProps> = ({
  booking,
  settings,
  documentId = 'confirmation-voucher-document',
}) => {
  // ===== Check-in pass: PDF417 stacked barcode carries the full welcome message (same data); Code-128 line carries the HCN =====
  // Rendered to offscreen canvases then exported as PNG <img> so the codes are
  // reliably captured by the PDF renderer (html2canvas copies images verbatim).
  const [pdf417Url, setPdf417Url] = useState('');
  const [hcnBarcodeUrl, setHcnBarcodeUrl] = useState('');

  const guestOrCompany =
    booking.bookingType === 'Group' ? booking.travelCompany || booking.customerName : booking.customerName;

  const welcomeMessage = [
    `Welcome to ${booking.hotelName}.`,
    `Your group registration for ${settings.legalEntityName || 'PT. TAMIMA JAYA WISATA'} with code ${booking.bookingRef} is logged.`,
    `Please proceed to the front desk to finalize your check-in details.`,
    ``,
    `Check-in Details`,
    `Group: ${guestOrCompany}`,
    `Code: ${booking.hcnRsvp}`,
    ``,
    `Hotel Information`,
    `${booking.hotelName} (${booking.starRating} Star) - ${booking.hotelCity}`,
    `Check-in: ${booking.checkInDate} | Check-out: ${booking.checkOutDate} (${booking.totalNights} Nights)`,
    `${booking.rooms.map((r) => `${r.numberOfRooms}x ${r.roomType} (${r.mealPlan})`).join(', ')}`,
    ``,
    `If you need help with your room assignment, luggage drop, or group schedule, let me know how I can assist you further.`,
  ].join('\n');

  useEffect(() => {
    if (!booking.hcnRsvp) {
      setPdf417Url('');
      return;
    }
    try {
      const hints = new Map();
      hints.set(EncodeHintType.MARGIN, 1);
      hints.set(EncodeHintType.CHARACTER_SET, 'UTF-8');
      const matrix = new MultiFormatWriter().encode(
        welcomeMessage,
        BarcodeFormat.PDF_417,
        560,
        150,
        hints
      );
      const w = matrix.getWidth();
      const h = matrix.getHeight();
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0f172a';
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (matrix.get(x, y)) ctx.fillRect(x, y, 1, 1);
        }
      }
      setPdf417Url(canvas.toDataURL('image/png'));
    } catch {
      setPdf417Url('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.hcnRsvp, booking.bookingRef, booking.hotelName, guestOrCompany]);

  useEffect(() => {
    if (!booking.hcnRsvp) {
      setHcnBarcodeUrl('');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, booking.hcnRsvp, {
        format: 'CODE128',
        width: 2,
        height: 34,
        margin: 4,
        displayValue: false,
        lineColor: '#0f172a',
        background: '#ffffff',
      });
      setHcnBarcodeUrl(canvas.toDataURL('image/png'));
    } catch {
      setHcnBarcodeUrl('');
    }
  }, [booking.hcnRsvp]);

  // ===== Customer payment status toward TAMIMA (vendor transactions stay internal) =====
  const pctPaid =
    booking.totalSellIDR > 0 ? Math.min(100, Math.round((booking.amountPaidIDR / booking.totalSellIDR) * 100)) : 0;
  const payState =
    booking.status === 'Paid'
      ? { label: 'LUNAS · FULL PAYMENT TO TAMIMA', chip: 'bg-emerald-500 text-white', bar: 'bg-emerald-500', txt: 'text-emerald-700' }
      : booking.status === 'Partial'
        ? { label: 'PARTIAL PAYMENT TO TAMIMA', chip: 'bg-amber-400 text-amber-950', bar: 'bg-amber-400', txt: 'text-amber-700' }
        : booking.status === 'Draft'
          ? { label: 'DRAFT / QUOTATION', chip: 'bg-slate-400 text-white', bar: 'bg-slate-400', txt: 'text-slate-500' }
          : { label: 'BELUM DIBAYAR · AWAITING PAYMENT', chip: 'bg-rose-500 text-white', bar: 'bg-rose-500', txt: 'text-rose-600' };

  const brand = {
    legalName: settings.legalEntityName || 'PT. TAMIMA JAYA WISATA',
    tagline: settings.tagline || 'Beyond LA & Handling Service · Hajj & Umrah Specialist',
    address: settings.indonesiaAddress || settings.address,
    wa: settings.waPhone || settings.phone,
    manager: settings.bookingManagerName || booking.staffName || 'GHOFAR',
    managerRole: settings.bookingManagerRole || 'Booking Manager',
    bookingPolicy: settings.bookingPolicy || [
      'Check-in from 16:00 · Check-out before 14:00 (local time*)',
      '* Subject to hotel availability & situation',
      'Original passport required at check-in',
      'Present this CL at hotel reception',
    ],
    cancellationPolicy: settings.cancellationPolicy || [
      '30+ days before: Full refund (-5% admin)',
      '14-29 days before: 50% refund · Less 14 days: Non-refundable',
      'No-show: Full charge · Date change subject to availability',
    ],
    mandiriName: settings.bankDetails.mandiriAccountName || settings.legalEntityName || 'PT. TAMIMA JAYA WISATA',
    mandiriNumber: settings.bankDetails.mandiriAccountNumber || '1370080001686',
  };

  const rate = averageTransactionRate(
    booking.paymentHistory,
    booking.exchangeRate || settings.defaultExchangeRateSARtoIDR
  );
  const totalPax = booking.groupSize.adults + booking.groupSize.children + booking.groupSize.infants;
  const totalRooms = booking.rooms.reduce((s, r) => s + (r.numberOfRooms || 0), 0);
  const balanceSAR = booking.totalSellSAR - booking.amountPaidSAR;
  const overpaid = balanceSAR < -0.5; // customer paid more than the bill → balance deposit
  const country = ['Makkah', 'Madina', 'Jeddah', 'Riyadh'].includes(booking.hotelCity)
    ? 'Saudi Arabia'
    : 'Indonesia';
  const meal = mealCode[booking.rooms[0]?.mealPlan || 'Breakfast'] || 'BB';

  const statusBadge = (() => {
    switch (booking.status) {
      case 'Paid':
        return { label: 'FULL PAYMENT', cls: 'bg-emerald-400 text-emerald-950 border-emerald-500' };
      case 'Partial':
        return { label: 'PARTIAL PAYMENT', cls: 'bg-amber-300 text-amber-950 border-amber-500' };
      case 'Unpaid':
        return { label: 'UNPAID / PENDING', cls: 'bg-rose-400 text-rose-950 border-rose-500' };
      case 'Cancelled':
        return { label: 'CANCELLED', cls: 'bg-slate-300 text-slate-800 border-slate-400' };
      default:
        return { label: 'DRAFT QUOTATION', cls: 'bg-slate-200 text-slate-700 border-slate-400' };
    }
  })();

  return (
    <div
      id={documentId}
      className="cl-document bg-white text-slate-900 w-[794px] min-w-[794px] max-w-[794px] mx-auto shadow-2xl border border-slate-200 relative overflow-hidden"
    >
      {/* Centered gradient company-logo watermark */}
      {settings.logoUrl && (
        <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none select-none">
          <img
            src={settings.logoUrl}
            alt=""
            className="w-[430px] max-w-[65%] opacity-[0.08]"
            style={{
              maskImage: 'radial-gradient(circle at center, black 15%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 15%, transparent 72%)',
            }}
          />
        </div>
      )}
      <div className="p-6 space-y-3 relative z-10">
        {/* ===== TOP HEADER ===== */}
        <div className="flex justify-between items-start gap-4">
          {/* Left: Issued by */}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold tracking-[0.16em] text-orange-600 uppercase">Issued By</p>
            <div className="flex items-center gap-3 mt-0.5 max-w-[465px]">
              {settings.logoUrl && (
                <img src={settings.logoUrl} alt="logo" className="h-12 max-w-[140px] object-contain" />
              )}
              <div>
                <h1 className="text-[24px] leading-[1.1] font-bold text-orange-600 tracking-[-0.02em]">
                  {brand.legalName}
                </h1>
                <p className="text-[10px] italic text-slate-600 font-medium leading-[1.35]">{brand.tagline}</p>
              </div>
            </div>
            <div className="mt-2 space-y-0.5 text-[9.5px] leading-[1.4] text-slate-700">
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-orange-600 mt-0.5 flex-shrink-0" />
                <span>{brand.address}</span>
              </p>
              <p className="flex items-center gap-1.5 font-semibold">
                <Phone className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                <span>WA: {brand.wa}</span>
              </p>
            </div>
          </div>

          {/* Right: Confirmation Letter box */}
          <div className="text-right flex-shrink-0">
            <div className="bg-orange-500 text-white px-5 py-2.5 rounded-sm shadow">
              <p className="text-[16px] font-bold tracking-[0.02em] leading-tight">CONFIRMATION LETTER</p>
              <p className="text-[9px] font-medium text-orange-100">Hotel Booking Confirmation</p>
            </div>
            <div className="mt-2 text-[10px] leading-[1.4] text-slate-700 space-y-0.5">
              <p>
                Invoice Ref: <span className="font-black text-orange-600 font-mono">{booking.bookingRef}</span>
              </p>
              <p>
                Date Issued: <span className="font-bold underline">{longDate(booking.createdAt)}</span>
              </p>
            </div>
            <span
              className={`inline-block mt-1.5 px-2.5 py-0.5 text-[9px] font-bold tracking-[0.08em] border rounded-sm ${statusBadge.cls}`}
            >
              {statusBadge.label}
            </span>
          </div>
        </div>

        {/* ===== GREETING ===== */}
        <p className="text-[10.5px] leading-[1.5] text-slate-800 border-t border-slate-200 pt-2.5">
          Dear <span className="font-black">{booking.customerName.toUpperCase()}</span>,{' '}
          <span className="text-slate-600">
            We are pleased to confirm your hotel booking with the following details. Please present this letter at check-in.
          </span>
        </p>

        {/* ===== GUEST & HOTEL INFO ===== */}
        <div className="grid grid-cols-2 gap-3 items-start">
          {/* Guest Information */}
          <div className="border border-slate-300 rounded-sm overflow-hidden">
            <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[11px] font-black tracking-wider">GUEST INFORMATION</span>
              <span
                className={`ml-auto text-[8px] font-black px-1.5 py-0.5 rounded ${
                  booking.bookingType === 'Group' ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'
                }`}
              >
                {booking.bookingType === 'Group' ? 'GROUP' : 'PRIVATE'}
              </span>
            </div>
            <table className="w-full text-[10.5px]">
              <tbody>
                {(booking.bookingType === 'Group'
                  ? [
                      ['Travel Company', booking.travelCompany || '-'],
                      ['Lead Contact', booking.customerName],
                      ['Phone / WA', booking.customerPhone || '-'],
                      ['No. of Pax', `${totalPax} Pax`],
                    ]
                  : [
                      ['Lead Guest', booking.customerName],
                      ['Passport / ID', booking.customerPassport || '-'],
                      ['Phone / WA', booking.customerPhone || '-'],
                      ['No. of Pax', `${totalPax} Pax`],
                    ]
                ).map(([label, value], i) => (
                  <tr key={label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-2.5 py-1.5 text-slate-500 w-[38%] border-r border-slate-200">{label}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-slate-900">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Hotel Information */}
          <div className="border border-slate-300 rounded-sm overflow-hidden">
            <div className="bg-orange-500 text-white px-3 py-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-black tracking-wider">HOTEL INFORMATION</span>
            </div>
            <table className="w-full text-[10.5px]">
              <tbody>
                {[
                  ['Hotel', booking.hotelName],
                  ...(booking.hcnRsvp ? [['HCN / RSVP #', booking.hcnRsvp]] : []),
                  ...(booking.hotelTransfer
                    ? [
                        [
                          'Moved From',
                          `${booking.hotelTransfer.fromHotel} (${
                            booking.hotelTransfer.type === 'client-upgrade' ? 'Client Upgrade' : 'Vendor Transfer'
                          } · ${booking.hotelTransfer.date})`,
                        ],
                      ]
                    : []),
                  ['City', booking.hotelCity],
                  ['Address', country],
                  ['Meal', meal],
                ].map(([label, value], i) => (
                  <tr key={label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-2.5 py-1.5 text-slate-500 w-[30%] border-r border-slate-200">{label}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-slate-900">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== STAY STATS ===== */}
        <div className="grid grid-cols-4 border border-orange-400 rounded-sm overflow-hidden divide-x divide-orange-300 bg-orange-50">
          <div className="px-2 py-2 text-center">
            <p className="text-[9px] font-black tracking-widest text-orange-600">CHECK-IN</p>
            <p className="text-[17px] font-black text-slate-900 leading-tight">{shortDate(booking.checkInDate)}</p>
            <p className="text-[9px] text-slate-500">From 16:00</p>
          </div>
          <div className="px-2 py-2 text-center">
            <p className="text-[9px] font-black tracking-widest text-orange-600">CHECK-OUT</p>
            <p className="text-[17px] font-black text-slate-900 leading-tight">{shortDate(booking.checkOutDate)}</p>
            <p className="text-[9px] text-slate-500">Before 14:00</p>
          </div>
          <div className="px-2 py-2 text-center">
            <p className="text-[9px] font-black tracking-widest text-orange-600">DURATION</p>
            <p className="text-[17px] font-black text-orange-600 leading-tight">{booking.totalNights} Nights</p>
            <p className="text-[9px] text-slate-500">Total Stay</p>
          </div>
          <div className="px-2 py-2 text-center">
            <p className="text-[9px] font-black tracking-widest text-orange-600">TOTAL ROOMS</p>
            <p className="text-[17px] font-black text-orange-600 leading-tight">{totalRooms}</p>
            <p className="text-[9px] text-slate-500">Booked</p>
          </div>
        </div>

        {/* ===== ROOM RESERVATION DETAILS ===== */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <BedDouble className="w-4 h-4 text-orange-600" />
            <span className="text-[11px] font-black tracking-widest text-slate-800">ROOM RESERVATION DETAILS</span>
          </div>
          <table className="w-full text-[10px] border border-slate-300 rounded-sm overflow-hidden">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-[9px] font-bold tracking-wide">
                <th className="px-3 py-1.5 text-left">ROOM TYPE</th>
                <th className="px-3 py-1.5 text-center">QTY</th>
                <th className="px-3 py-1.5 text-center">NIGHTS</th>
                <th className="px-3 py-1.5 text-right">RATE/NIGHT</th>
                <th className="px-3 py-1.5 text-right">SUBTOTAL (SAR)</th>
              </tr>
            </thead>
            <tbody>
              {booking.rooms.map((room, i) => (
                <tr key={room.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-1.5 font-bold text-slate-900">{room.roomType}</td>
                  <td className="px-3 py-1.5 text-center">
                    {room.numberOfRooms} Room{room.numberOfRooms > 1 ? 's' : ''}
                  </td>
                  <td className="px-3 py-1.5 text-center">{booking.totalNights}</td>
                  <td className="px-3 py-1.5 text-right">SAR {idNum(room.sellPerNight)}</td>
                  <td className="px-3 py-1.5 text-right font-black">
                    SAR {idNum(room.sellPerNight * room.numberOfRooms * booking.totalNights)}
                  </td>
                </tr>
              ))}
              {booking.additionalServices.length === 0 ? (
                <tr className="bg-sky-50/60">
                  <td className="px-3 py-1.5 font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-sky-700" /> Transport (Ground)
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center text-slate-400">-</td>
                  <td className="px-3 py-1.5 text-center text-slate-400">-</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">-</td>
                  <td className="px-3 py-1.5 text-right font-bold text-slate-600">SAR 0</td>
                </tr>
              ) : (
                booking.additionalServices.map((s) => (
                  <tr key={s.id} className="bg-sky-50/60">
                    <td className="px-3 py-1.5 font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-sky-700" /> {s.description}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center text-slate-400">-</td>
                    <td className="px-3 py-1.5 text-center text-slate-400">-</td>
                    <td className="px-3 py-1.5 text-right text-slate-400">-</td>
                    <td className="px-3 py-1.5 text-right font-bold text-slate-700">SAR {idNum(s.sell)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Grand Total & IDR bars */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-2 flex justify-between items-center mt-0">
            <span className="text-[11px] font-black tracking-widest">GRAND TOTAL</span>
            <span className="text-[15px] font-black font-mono flex items-center gap-1">
              <RiyalIcon className="w-3.5 h-3.5" /> SAR {idNum(booking.totalSellSAR)}
            </span>
          </div>
          <div className="bg-slate-900 text-white px-3 py-1.5 flex justify-between items-center">
            <span className="text-[10px] font-bold tracking-wider">
              AVERAGE TRANSACTION RATE
            </span>
            <span className="text-[13px] font-black font-mono">1 SAR = {idNum(rate, 2)} IDR</span>
          </div>
          <p className="bg-orange-50 border-x border-b border-orange-200 px-3 py-1 text-[7px] font-bold text-orange-800">
            Note: The average exchange rate is weighted from invoice transaction history and follows the rate applicable when each transaction was made.
          </p>
        </div>

        {/* ===== PAYMENT SUMMARY BOXES ===== */}
        <div className="grid grid-cols-4 gap-2.5">
          <div className="border-2 border-emerald-400 bg-emerald-50 rounded-sm px-2 py-2 text-center">
            <p className="text-[8.5px] font-black tracking-widest text-emerald-700">TOTAL AMOUNT</p>
            <p className="text-[13px] font-black text-emerald-700 leading-tight">SAR {idNum(booking.totalSellSAR)}</p>
            <p className="text-[9px] text-emerald-600 font-bold mt-0.5">Invoice amount in SAR</p>
          </div>
          <div className="border-2 border-blue-400 bg-blue-50 rounded-sm px-2 py-2 text-center">
            <p className="text-[8.5px] font-black tracking-widest text-blue-700">AMOUNT PAID</p>
            <p className="text-[13px] font-black text-blue-700 leading-tight">IDR {idNum(booking.amountPaidIDR)}</p>
            <p className="text-[9px] text-blue-600 font-bold mt-0.5">
              ≈ SAR {idNum(booking.amountPaidSAR, 2)} · Kurs {idNum(booking.paymentExchangeRate || rate)}
            </p>
          </div>
          <div className="border-2 border-orange-400 bg-orange-50 rounded-sm px-2 py-2 text-center">
            <p className="text-[8.5px] font-black tracking-widest text-orange-700">BALANCE (SAR)</p>
            <p className="text-[13px] font-black text-orange-600 leading-tight">SAR {idNum(balanceSAR, 2)}</p>
            <p className="text-[9px] text-orange-500 font-bold mt-0.5">Mata Uang Asal</p>
          </div>
          {overpaid ? (
            <div className="border-2 border-emerald-500 bg-emerald-50 rounded-sm px-2 py-2 text-center">
              <p className="text-[8.5px] font-black tracking-widest text-emerald-700">BALANCE DEPOSIT</p>
              <p className="text-[13px] font-black text-emerald-600 leading-tight">SAR {idNum(Math.abs(balanceSAR), 2)}</p>
              <p className="text-[9px] text-emerald-600 font-bold mt-0.5">Kelebihan bayar · balance dalam SAR</p>
            </div>
          ) : (
            <div className="border-2 border-rose-400 bg-rose-50 rounded-sm px-2 py-2 text-center">
              <p className="text-[8.5px] font-black tracking-widest text-rose-700">OUTSTANDING</p>
              <p className="text-[13px] font-black text-rose-600 leading-tight">SAR {idNum(balanceSAR, 2)}</p>
              <p className="text-[9px] text-rose-500 font-bold mt-0.5">Balance dicatat dalam SAR</p>
            </div>
          )}
        </div>

        {/* ===== PAYMENT STATUS TO TAMIMA (customer-facing; vendor data never shown) ===== */}
        <div className="border-2 border-slate-800 rounded-sm px-3 py-2.5 bg-white">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`text-[9px] font-black tracking-widest px-2.5 py-1 rounded-sm ${payState.chip}`}>
              {payState.label}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
              Status Pembayaran Customer kepada TAMIMA
            </span>
            <span className={`ml-auto text-[11px] font-black ${payState.txt}`}>{pctPaid}%</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div className={`h-full ${payState.bar} transition-all`} style={{ width: `${pctPaid}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[8.5px] font-bold text-slate-500">
            <span>
              Diterima TAMIMA: <span className="text-emerald-700">IDR {idNum(booking.amountPaidIDR)}</span>
            </span>
            <span>
              {overpaid ? 'Balance Deposit: ' : 'Sisa Tagihan: '}
              <span className={overpaid || balanceSAR <= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                {overpaid ? `SAR ${idNum(Math.abs(balanceSAR), 2)}` : `SAR ${idNum(balanceSAR, 2)}`}
              </span>
            </span>
          </div>
        </div>

        {/* ===== PAYMENT DETAIL + HISTORY (customer ↔ company) ===== */}
        <div className="border-2 border-slate-800 rounded-sm overflow-hidden">
          <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between">
            <span className="text-[8px] font-black tracking-[0.2em] flex items-center gap-1.5">
              <CreditCard className="w-3 h-3 text-emerald-400" /> DETAIL PEMBAYARAN · PAYMENT DETAIL
            </span>
            <span className="text-[8px] font-mono text-slate-300">Kurs transaksi tercatat per termin</span>
          </div>

          <div className="grid grid-cols-4 divide-x divide-slate-200 text-center">
            <div className="px-2 py-2 bg-slate-50">
              <p className="text-[7.5px] font-black text-slate-500 uppercase tracking-wider">Total Tagihan</p>
              <p className="text-[11px] font-black text-slate-900">SAR {idNum(booking.totalSellSAR)}</p>
              <p className="text-[8px] text-slate-500">Avg rate: 1 SAR = {idNum(rate, 2)} IDR</p>
            </div>
            <div className="px-2 py-2 bg-emerald-50">
              <p className="text-[7.5px] font-black text-emerald-700 uppercase tracking-wider">Paid / Diterima</p>
              <p className="text-[11px] font-black text-emerald-700">SAR {idNum(booking.amountPaidSAR)}</p>
              <p className="text-[8px] text-emerald-600">IDR {idNum(booking.amountPaidIDR)}</p>
            </div>
            <div className={`px-2 py-2 ${overpaid ? 'bg-teal-50' : 'bg-rose-50'}`}>
              <p className={`text-[7.5px] font-black uppercase tracking-wider ${overpaid ? 'text-teal-700' : 'text-rose-700'}`}>
                {overpaid ? 'Balance Deposit' : 'Outstanding'}
              </p>
              <p className={`text-[11px] font-black ${overpaid ? 'text-teal-700' : 'text-rose-700'}`}>
                SAR {idNum(Math.abs(balanceSAR), 2)}
              </p>
              <p className={`text-[8px] ${overpaid ? 'text-teal-600' : 'text-rose-600'}`}>Balance recorded in SAR</p>
            </div>
            <div className="px-2 py-2 bg-blue-50">
              <p className="text-[7.5px] font-black text-blue-700 uppercase tracking-wider">Balance</p>
              <p className="text-[11px] font-black text-blue-800">
                {balanceSAR >= 0 ? `${idNum(pctPaid)}% paid` : `+SAR ${idNum(Math.abs(balanceSAR), 2)}`}
              </p>
              <p className="text-[8px] text-blue-600">
                {balanceSAR >= 0 ? `Sisa SAR ${idNum(balanceSAR, 2)}` : 'Kelebihan bayar → deposit'}
              </p>
            </div>
          </div>

          {(booking.paymentHistory?.length ?? 0) > 0 && (
            <table className="w-full text-[8.5px]">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[14%]" />
                <col className="w-[23%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="px-2 py-1 text-left font-black uppercase tracking-wider">#</th>
                  <th className="px-2 py-1 text-left font-black uppercase tracking-wider">Tanggal</th>
                  <th className="px-2 py-1 text-left font-black uppercase tracking-wider">Metode</th>
                  <th className="px-2 py-1 text-left font-black uppercase tracking-wider">Referensi</th>
                  <th className="px-2 py-1 text-right font-black uppercase tracking-wider">Kurs</th>
                  <th className="px-2 py-1 text-right font-black uppercase tracking-wider">SAR</th>
                  <th className="px-2 py-1 text-right font-black uppercase tracking-wider">IDR</th>
                </tr>
              </thead>
              <tbody>
                {booking.paymentHistory!.map((p, i) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-2 py-1 font-black text-slate-500">{i + 1}</td>
                    <td className="px-2 py-1">{new Date(p.date).toLocaleDateString('id-ID')}</td>
                    <td className="px-2 py-1">{p.method}</td>
                    <td className="px-2 py-1 font-mono text-slate-500">{p.reference || '-'}</td>
                    <td className="px-2 py-1 text-right font-mono">{p.exchangeRate ? idNum(p.exchangeRate) : '-'}</td>
                    <td className="px-2 py-1 text-right font-bold">{idNum(p.amountSAR, 2)}</td>
                    <td className="px-2 py-1 text-right font-bold text-emerald-700">{idNum(p.amountIDR)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-black">
                  <td colSpan={5} className="px-2 py-1 text-right text-slate-700">TOTAL DITERIMA TAMIMA</td>
                  <td className="px-2 py-1 text-right text-emerald-800">SAR {idNum(booking.amountPaidSAR)}</td>
                  <td className="px-2 py-1 text-right text-emerald-800">IDR {idNum(booking.amountPaidIDR)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* ===== POLICIES ===== */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="border border-emerald-300 bg-emerald-50/60 rounded-sm p-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-emerald-800 mb-1">
              <ClipboardList className="w-3.5 h-3.5" /> BOOKING POLICY
            </p>
            <ul className="space-y-0.5 text-[9.5px] text-slate-700 list-disc list-inside">
              {brand.bookingPolicy.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="border border-rose-300 bg-rose-50/60 rounded-sm p-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-rose-800 mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> CANCELLATION POLICY
            </p>
            <ul className="space-y-0.5 text-[9.5px] text-slate-700 list-disc list-inside">
              {brand.cancellationPolicy.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ===== NOTE / PAYMENT ===== */}
        <div className="border-2 border-amber-400 bg-amber-50 rounded-sm px-3 py-2 flex items-center gap-2.5 text-[10.5px] text-slate-800">
          <span className="flex items-center gap-1 bg-amber-300 text-amber-950 font-black text-[9px] tracking-wider px-2 py-1 rounded-sm whitespace-nowrap">
            <CreditCard className="w-3 h-3" /> NOTE / PAYMENT
          </span>
          <p>
            Pembayaran melalui akun <span className="font-black text-blue-700">Bank Mandiri</span> a/n{' '}
            <span className="font-black">{brand.mandiriName}</span> · No. Rek.{' '}
            <span className="font-mono font-black border border-blue-400 text-blue-800 bg-white px-1.5 py-0.5 rounded-sm">
              {brand.mandiriNumber}
            </span>
          </p>
        </div>

        {/* ===== CENTERED CHECK-IN PASS: PDF417 stacked barcode (full welcome message) + Code-128 HCN line ===== */}
        {booking.hcnRsvp && pdf417Url && (
          <div className="border-2 border-slate-800 rounded-sm bg-white px-4 py-3 flex flex-col items-center transition-shadow hover:shadow-lg">
            <p className="text-[7px] font-black text-orange-600 uppercase tracking-[0.26em]">
              Welcome to {booking.hotelName}
            </p>

            {/* PDF417 PNG — scanning reveals the complete check-in assistant message; renders reliably in PDF export */}
            <img
              src={pdf417Url}
              alt="Check-in barcode PDF417"
              className="bg-white mt-2 w-full max-w-[440px] h-auto"
            />
            <p className="text-[6.5px] font-black text-slate-500 uppercase tracking-[0.18em] mt-1">
              Scan Barcode · Check-In Assistant · {booking.bookingRef}
            </p>

            <div className="w-full border-t border-dashed border-slate-300 mt-2 pt-2 flex items-center justify-center gap-3">
              {hcnBarcodeUrl && (
                <img src={hcnBarcodeUrl} alt="HCN barcode" className="bg-white h-[30px] w-auto" />
              )}
              <div className="text-left">
                <p className="font-mono font-black text-[11px] text-indigo-700 tracking-[0.18em] leading-none">
                  {booking.hcnRsvp}
                </p>
                <p className="text-[6.5px] font-bold text-slate-500 mt-0.5 leading-snug">
                  Group: {guestOrCompany} · {booking.checkInDate} → {booking.checkOutDate}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== SIGNATURE FOOTER ===== */}
        <div className="flex justify-between items-end pt-2 border-t border-slate-200 gap-4">
          <div className="text-[10px] text-slate-600 max-w-[60%]">
            <p>
              Thank you for choosing <span className="font-black text-orange-600">{brand.legalName}</span> as your
              trusted Hajj & Umrah travel partner. We wish you a blessed and comfortable stay.
            </p>
            <p className="italic text-slate-400 mt-1.5">System-generated confirmation · No physical signature required</p>
            <p className="italic text-slate-400">
              Generated on{' '}
              {new Date().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
              ,{' '}
              {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="text-center flex-shrink-0">
            <p className="text-[10px] text-slate-600 mb-1">Authorized Signature,</p>
            {settings.stampUrl ? (
              <img
                src={settings.stampUrl}
                alt="Authorized Stamp"
                className="w-24 h-24 mx-auto object-contain opacity-90 rotate-[-6deg] drop-shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 mx-auto rounded-full border-[3px] border-slate-400/70 flex flex-col items-center justify-center text-slate-400/80 rotate-[-8deg]">
                <CalendarDays className="w-5 h-5" />
                <span className="text-[7px] font-black tracking-widest mt-0.5">TAMIMA</span>
                <span className="text-[6px] font-bold tracking-wider">VERIFIED</span>
              </div>
            )}
            <p className="text-[11px] font-black text-slate-900 mt-1">( {brand.manager.toUpperCase()} )</p>
            <p className="text-[9.5px] text-slate-500">{brand.managerRole}</p>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM BAR ===== */}
      <div className="bg-slate-900 text-white text-center text-[10px] font-bold tracking-widest py-2 px-4 relative z-10">
        {brand.legalName.toUpperCase()} · {brand.tagline.toUpperCase()} · {booking.bookingRef}
      </div>
    </div>
  );
};

export default VoucherDocument;
