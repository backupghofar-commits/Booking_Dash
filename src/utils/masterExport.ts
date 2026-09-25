import * as XLSX from 'xlsx';
import { Booking } from '../types/booking';
import { ROOM_CODES, normalizeRoomType, type RoomCode } from './finance';
import type { MasterBooking } from './masterImport';

export const MASTER_FILENAME = 'TAMIMA_Hotel_Profitability_Master_Import_Export_Template';

const labelToCode = (label: string): RoomCode | null => {
  return normalizeRoomType(label);
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function masterHeader(): string[] {
  const h = [
    'bookingNumber', 'hotelName', 'customerName', 'vendorName', 'picName',
    'salesName', 'checkInDate', 'checkOutDate', 'nights', 'status',
  ];
  const roomNames: Record<RoomCode, string> = {
    DBL: 'Double', TRP: 'Triple', QRD: 'Quad', QNT: 'Quint', BED: 'Bed', EXT: 'ExtraBed',
  };
  (['buy', 'sell'] as const).forEach((side) => {
    ROOM_CODES.forEach((code) => {
      h.push(`${side}${roomNames[code]}Qty`, `${side}${roomNames[code]}Rate`);
    });
    h.push(
      `${side}Meal`, `${side}VAT`, `${side}Transaction`, `${side}TotalSAR`,
      side === 'buy' ? 'buyIDRPaid' : 'sellIDRReceived',
      `${side}IDROutstanding`, `${side}ActualIDR`
    );
  });
  h.push('netProfitIDR', 'netProfitMarginPct', 'currency', 'exchangeRate', 'notes');
  return h;
}

export function bookingToMasterRow(b: Booking): (string | number)[] {
  const side = (sideKind: 'buy' | 'sell') => {
    const cells: (string | number)[] = [];
    const source = b.importSource?.[sideKind];
    ROOM_CODES.forEach((code) => {
      if (source) {
        const room = source.rooms[code];
        cells.push(room?.qty ?? '', room?.rate ?? '');
        return;
      }
      const r = b.rooms.find((x) => labelToCode(x.roomType) === code);
      cells.push(r?.numberOfRooms ?? 0, round2(r ? (sideKind === 'buy' ? r.costPerNight : r.sellPerNight) : 0));
    });
    const meal = source?.meal ?? b.rooms[0]?.mealPlan ?? '';
    const trans = Math.round(b.additionalServices.reduce((s, x) => s + (sideKind === 'buy' ? x.cost : x.sell), 0));
    cells.push(
      meal,
      source?.vat ?? '-',
      source?.trans ?? trans,
      source?.totalSAR ?? round2(sideKind === 'buy' ? b.totalCostSAR : b.totalSellSAR),
      source?.idrMasuk ?? round2(sideKind === 'buy' ? (b.vendorPayments?.reduce((s, p) => s + p.amountIDR, 0) ?? 0) : b.amountPaidIDR),
      source?.sisaIDR ?? round2(sideKind === 'buy'
        ? b.totalCostIDR - (b.vendorPayments?.reduce((s, p) => s + p.amountIDR, 0) ?? 0)
        : b.totalSellIDR - b.amountPaidIDR),
      source?.totalIDRActual ?? round2(sideKind === 'buy' ? b.totalCostIDR : b.totalSellIDR)
    );
    return cells;
  };
  return [
    b.importSource?.bookingNo || b.bookingRef,
    b.hotelName, b.travelCompany || b.customerName, b.vendorName || '', b.vendorPic || '', b.staffName,
    b.checkInDate, b.checkOutDate, b.totalNights, b.status,
    ...side('buy'), ...side('sell'),
    b.importSource?.netProfitIDR ?? round2(b.profitIDR),
    b.importSource?.marginPct ?? round2(b.profitMarginPercent),
    b.importSource?.currency || b.inputCurrency,
    b.importSource?.exchangeRate ?? b.exchangeRate,
    b.importSource?.notes || b.notes || '',
  ];
}

export function exportMasterXlsx(bookings: Booking[], filename = MASTER_FILENAME) {
  const aoa = [masterHeader(), ...bookings.map(bookingToMasterRow)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = masterHeader().map((h) => ({ wch: Math.max(10, Math.min(24, h.length + 4)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportMasterCsv(bookings: Booking[], filename = MASTER_FILENAME) {
  const aoa = [masterHeader(), ...bookings.map(bookingToMasterRow)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const README_ROWS: string[][] = [
  ['TAMIMA HOTEL BOOKING — MASTER IMPORT TEMPLATE'],
  [''],
  ['SUPPORTED FILE TYPES', 'XLSX · XLS binary · XLS legacy HTML-table · CSV (comma/semicolon/tab, UTF-8/BOM) · PDF text-table'],
  ['REQUIRED FIELDS', 'booking_no, hotel, customer, check_in, check_out, BUY & SELL room Q/R, Total SAR, IDR Masuk, Sisa IDR, Total IDR Aktual'],
  ['OPTIONAL FIELDS', 'vendor, pic, sales, VAT, Trans, Meal, status, Net Profit IDR, Margin %, currency, exchangeRate, notes'],
  ['DATE FORMAT', 'YYYY-MM-DD (also accepts 12 September 2026, 12/09/2026, Sep 12 2026, Excel serial)'],
  ['CURRENCY FORMAT', 'SAR 16.280 · IDR 76.597.400 · 1.950.197.726,84 · negatives preserved (-61.750)'],
  ['ROOM FORMAT', 'qty/rate per cell, e.g. 5/430 · 0/0 = zero · blank/N/A/- = null (never coerced to 0)'],
  ['BUY / SELL', 'BUY = modal/vendor cost · SELL = harga jual customer · keduanya wajib terpisah'],
  ['DUPLICATE RULES', 'fingerprint = booking_no+hotel+customer+check_in+check_out+vendor (normalized) → EXACT / POSSIBLE / NEW'],
  ['CALCULATION RULES', 'Total = Σ(qty×rate) + VAT + Trans · Net Profit = SELL IDR − BUY IDR · Margin = profit/sell×100 · Total IDR Aktual = IDR Masuk + Sisa IDR'],
  ['IMPORT MODES', 'SAFE (PASS only) · WITH WARNING (PASS+WARNING) · FULL REVIEW (user confirms mismatch)'],
  ['WARNINGS', 'DATE_DURATION_MISMATCH · CALCULATION_MISMATCH · PAYMENT_RECONCILIATION_WARNING · POSSIBLE_DUPLICATE · OVERPAYMENT/CREDIT'],
  ['ERRORS', 'missing booking no · invalid date · invalid numeric · broken BUY/SELL · OCR_REQUIRED (scanned PDF)'],
];

export function downloadMasterTemplate() {
  const sample = masterHeader().map((h) => {
    if (h === 'bookingNumber') return 'BOOKING #1';
    if (h === 'checkInDate' || h === 'checkOutDate') return 'YYYY-MM-DD';
    if (h === 'nights') return 1;
    if (/(Qty|Rate|VAT|Transaction|TotalSAR|IDRPaid|IDRReceived|IDROutstanding|ActualIDR|netProfitIDR|netProfitMarginPct|exchangeRate)$/.test(h)) return 0;
    if (h === 'currency') return 'SAR';
    return '';
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([masterHeader(), sample]);
  ws['!cols'] = masterHeader().map((h) => ({ wch: Math.max(10, Math.min(24, h.length + 4)) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(README_ROWS), 'README');
  XLSX.writeFile(wb, `${MASTER_FILENAME}.xlsx`);
}

interface AuditLike { importId?: string; filename?: string; uploadedAt?: string; mode?: string; result?: string; valid?: number; warning?: number; error?: number }

/** Professional multi-sheet canonical export built from database data (never UI state) */
export function exportMasterWorkbookFull(bookings: Booking[], audit?: AuditLike | null) {
  const wb = XLSX.utils.book_new();
  const summary = bookings.map((b) => ({
    booking_no: b.bookingRef, hotel: b.hotelName, customer: b.travelCompany || b.customerName,
    vendor: b.vendorName || '', check_in: b.checkInDate, check_out: b.checkOutDate,
    nights: b.totalNights, status: b.status,
    'BUY SAR': Math.round(b.totalCostSAR), 'SELL SAR': Math.round(b.totalSellSAR),
    'Net Profit IDR': Math.round(b.profitIDR), 'Margin %': Math.round(b.profitMarginPercent * 100) / 100,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'BOOKING SUMMARY');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([masterHeader(), ...bookings.map(bookingToMasterRow)]), 'BOOKING DETAIL');
  const buyRows = bookings.map((b) => {
    const r: Record<string, string | number> = { booking_no: b.bookingRef, hotel: b.hotelName };
    ROOM_CODES.forEach((c) => { const rm = b.rooms.find((x) => labelToCode(x.roomType) === c); r[`${c} qty`] = rm?.numberOfRooms ?? 0; r[`${c} rate`] = Math.round(rm?.costPerNight ?? 0); });
    r['Total SAR'] = Math.round(b.totalCostSAR); r['IDR Aktual'] = Math.round(b.totalCostIDR);
    return r;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buyRows), 'BUY DETAIL');
  const sellRows = bookings.map((b) => {
    const r: Record<string, string | number> = { booking_no: b.bookingRef, hotel: b.hotelName, customer: b.travelCompany || b.customerName };
    ROOM_CODES.forEach((c) => { const rm = b.rooms.find((x) => labelToCode(x.roomType) === c); r[`${c} qty`] = rm?.numberOfRooms ?? 0; r[`${c} rate`] = Math.round(rm?.sellPerNight ?? 0); });
    r['Total SAR'] = Math.round(b.totalSellSAR); r['IDR Masuk'] = Math.round(b.amountPaidIDR);
    r['Sisa IDR'] = Math.round(b.totalSellIDR - b.amountPaidIDR); r['IDR Aktual'] = Math.round(b.totalSellIDR);
    return r;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sellRows), 'SELL DETAIL');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bookings.map((b) => ({
    booking_no: b.bookingRef, 'Buy IDR': Math.round(b.totalCostIDR), 'Sell IDR': Math.round(b.totalSellIDR),
    'Net Profit IDR': Math.round(b.profitIDR), 'Margin %': Math.round(b.profitMarginPercent * 100) / 100,
  }))), 'PROFITABILITY');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(audit ? [[
    'importId', audit.importId || '', 'file', audit.filename || '', 'when', audit.uploadedAt || '',
    'mode', audit.mode || '', 'result', audit.result || '', 'valid', audit.valid ?? '', 'warning', audit.warning ?? '', 'error', audit.error ?? '',
  ]] : [['No audit attached']]), 'IMPORT AUDIT');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(README_ROWS), 'README');
  XLSX.writeFile(wb, `TAMIMA_Master_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ---------------- Round-trip audit ---------------- */

export interface RoundTripDiff { bookingNo: string; field: string; original: string; reimported: string }

export function roundTripCompare(original: Booking[], reimported: MasterBooking[]): RoundTripDiff[] {
  const diffs: RoundTripDiff[] = [];
  const byNo = new Map(reimported.map((r) => [r.bookingNo.toLowerCase(), r]));
  original.forEach((b) => {
    const key = b.bookingRef.toLowerCase();
    const r = byNo.get(key) || byNo.get(key.replace('imp-', '#'));
    if (!r) { diffs.push({ bookingNo: b.bookingRef, field: '(record)', original: 'present', reimported: 'MISSING' }); return; }
    const cmp = (field: string, a: string, c: string) => { if (a !== c) diffs.push({ bookingNo: b.bookingRef, field, original: a, reimported: c }); };
    cmp('hotel', b.hotelName, r.hotel || '');
    cmp('customer', b.travelCompany || b.customerName, r.customer || '');
    cmp('check_in', b.checkInDate, r.checkIn || '');
    cmp('check_out', b.checkOutDate, r.checkOut || '');
    cmp('nights', String(b.totalNights), String(r.sourceNights ?? r.calcNights ?? ''));
    cmp('sell_total_sar', String(Math.round(b.totalSellSAR)), String(Math.round(r.sell.totalSAR ?? 0)));
    cmp('buy_total_sar', String(Math.round(b.totalCostSAR)), String(Math.round(r.buy.totalSAR ?? 0)));
    cmp('sell_total_idr', String(Math.round(b.totalSellIDR)), String(Math.round(r.sell.totalIDRActual ?? 0)));
    cmp('buy_total_idr', String(Math.round(b.totalCostIDR)), String(Math.round(r.buy.totalIDRActual ?? 0)));
    cmp('profit_idr', String(round2(b.profitIDR)), String(round2(r.netProfitIDR ?? 0)));
    cmp('margin_pct', String(round2(b.profitMarginPercent)), String(round2(r.marginPct ?? 0)));
    ROOM_CODES.forEach((c) => {
      const ob = b.rooms.find((x) => labelToCode(x.roomType) === c);
      const buy = r.buy.rooms[c];
      const rb = r.sell.rooms[c];
      cmp(`BUY ${c} qty`, String(ob?.numberOfRooms ?? 0), String(buy.qty ?? 0));
      cmp(`BUY ${c} rate`, String(round2(ob?.costPerNight ?? 0)), String(round2(buy.rate ?? 0)));
      cmp(`SELL ${c} qty`, String(ob?.numberOfRooms ?? 0), String(rb.qty ?? 0));
      cmp(`SELL ${c} rate`, String(round2(ob?.sellPerNight ?? 0)), String(round2(rb.rate ?? 0)));
    });
  });
  return diffs;
}
