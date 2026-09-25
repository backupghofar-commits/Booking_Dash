import { Booking, CompanySettings, PaymentRecord } from '../types/booking';
import { generateInvoiceRef } from './invoiceRef';

/** Room columns exactly as the uploaded template (BUY = modal vendor, SELL = harga jual) */
export const ROOM_COLS: { code: string; label: string }[] = [
  { code: 'DBL', label: 'Double' },
  { code: 'TRP', label: 'Triple' },
  { code: 'QRD', label: 'Quad' },
  { code: 'QNT', label: 'Quint' },
  { code: 'BED', label: 'Bed' },
  { code: 'EXT', label: 'Extra' },
];

const NAVY = 'background:#1f3864;color:#fff;font-size:8px;font-weight:bold;text-align:center;padding:4px 3px;border:1px solid #16294a';
const CELL = 'font-size:8.5px;padding:3px 4px;border:1px solid #cbd5e1';

const fmtDateInput = (iso: string) => iso || '[YYYY-MM-DD]';

/** Styled HTML body matching the uploaded template, empty (template) or filled (data export) */
export function buildTemplateHtml(
  mode: 'template' | 'data',
  bookings: Booking[],
  settings: CompanySettings
): string {
  const legal = settings.legalEntityName || 'PT. TAMIMA JAYA WISATA';

  const roomHeader = ROOM_COLS.map((r) => `<th style="${NAVY}">${r.code} Qty</th><th style="${NAVY}">${r.code} Rate</th>`).join('');
  const payHeader = Array.from({ length: 5 }, (_, i) => `<th colspan="2" style="${NAVY}">Pembayaran ${i + 1}</th>`).join('');
  const paySub = Array.from({ length: 5 }, () => `<th style="${NAVY}">IDR</th><th style="${NAVY}">Kurs</th>`).join('');

  const blocks = (mode === 'data' ? bookings : [null]).map((b) => {
    const roomOf = (label: string) => b?.rooms.find((r) => r.roomType === label);
    const buyCells = ROOM_COLS.map((r) => {
      const rm = roomOf(r.label);
      return `<td style="${CELL};text-align:center;background:#fdeaea">${rm ? rm.numberOfRooms : 0}</td><td style="${CELL};text-align:center;background:#fdeaea">${rm ? Math.round(rm.costPerNight) : 0}</td>`;
    }).join('');
    const sellCells = ROOM_COLS.map((r) => {
      const rm = roomOf(r.label);
      return `<td style="${CELL};text-align:center;background:#eaf7ee">${rm ? rm.numberOfRooms : 0}</td><td style="${CELL};text-align:center;background:#eaf7ee">${rm ? Math.round(rm.sellPerNight) : 0}</td>`;
    }).join('');

    const nights = b?.totalNights ?? '[auto]';
    const transportBuy = b ? Math.round(b.additionalServices.reduce((s, x) => s + x.cost, 0)) : 0;
    const transportSell = b ? Math.round(b.additionalServices.reduce((s, x) => s + x.sell, 0)) : 0;

    const payCells = (side: 'buy' | 'sell') =>
      Array.from({ length: 5 }, (_, i) => {
        const p = side === 'sell' ? b?.paymentHistory?.[i] : undefined;
        return `<td style="${CELL};text-align:right;background:${side === 'buy' ? '#fdeaea' : '#eaf7ee'}">${p ? Math.round(p.amountIDR) : 0}</td><td style="${CELL};text-align:center;background:${side === 'buy' ? '#fdeaea' : '#eaf7ee'}">${p?.exchangeRate ? Math.round(p.exchangeRate) : 0}</td>`;
      }).join('');

    const meta =
      mode === 'template'
        ? { hotel: '[isi nama hotel]', customer: '[isi nama customer]', pic: '[isi nama PIC]', vendor: '[isi nama vendor]', sales: '[isi nama sales]' }
        : { hotel: b!.hotelName, customer: b!.bookingType === 'Group' ? b!.travelCompany || b!.customerName : b!.customerName, pic: b!.vendorPic || b!.staffName, vendor: b!.vendorName || '-', sales: b!.staffName };

    return `
    <tr><td colspan="21" style="background:#fdf6d8;font-size:9px;font-weight:bold;padding:3px 5px;border:1px solid #e5d9a8">&#128203; METADATA TRANSAKSI${mode === 'data' ? ` &mdash; ${b!.bookingRef}` : ''}</td></tr>
    <tr>
      <td colspan="1" style="${CELL};font-weight:bold;background:#fdf6d8">HOTEL:</td><td colspan="5" style="${CELL}">${meta.hotel}</td>
      <td colspan="1" style="${CELL};font-weight:bold;background:#fdf6d8">CUSTOMER:</td><td colspan="5" style="${CELL}">${meta.customer}</td>
      <td colspan="1" style="${CELL};font-weight:bold;background:#fdf6d8">PIC INTERNAL:</td><td colspan="4" style="${CELL}">${meta.pic}</td>
      <td colspan="1" style="${CELL};font-weight:bold;background:#fdf6d8">VENDOR:</td><td colspan="5" style="${CELL}">${meta.vendor}</td>
      <td colspan="2" style="${CELL};font-weight:bold;background:#fdf6d8">SALES PERSON:</td><td colspan="5" style="${CELL}">${meta.sales}</td>
    </tr>
    <tr><td colspan="30" style="height:6px"></td></tr>
    <tr>
      <th rowspan="2" style="${NAVY}">#</th>
      <th colspan="2" style="${NAVY}">Date</th>
      <th rowspan="2" style="${NAVY}">Total<br/>Night</th>
      <th colspan="12" style="${NAVY}">Room Type &amp; Rate (SAR)</th>
      <th rowspan="2" style="${NAVY}">Meal Plan</th>
      <th rowspan="2" style="${NAVY}">VAT</th>
      <th rowspan="2" style="${NAVY}">Transport</th>
      <th rowspan="2" style="${NAVY}">Total Tagihan SAR</th>
      ${payHeader}
    </tr>
    <tr>
      <th style="${NAVY}">Check In</th><th style="${NAVY}">Check Out</th>
      ${roomHeader}
      ${paySub}
    </tr>
    <tr>
      <td style="${CELL};font-weight:900;background:#fdeaea">BUY</td>
      <td style="${CELL};background:#fdeaea">${mode === 'template' ? '[YYYY-MM-DD]' : fmtDateInput(b!.checkInDate)}</td>
      <td style="${CELL};background:#fdeaea">${mode === 'template' ? '[YYYY-MM-DD]' : fmtDateInput(b!.checkOutDate)}</td>
      <td style="${CELL};text-align:center;background:#fdeaea">${nights}</td>
      ${buyCells}
      <td style="${CELL};text-align:center;background:#fdeaea">${b?.rooms[0]?.mealPlan || 'FB'}</td>
      <td style="${CELL};text-align:center;background:#fdeaea">-</td>
      <td style="${CELL};text-align:center;background:#fdeaea">${transportBuy}</td>
      <td style="${CELL};text-align:right;background:#fdeaea;font-weight:bold">${mode === 'template' ? '[auto]' : `SAR ${Math.round(b!.totalCostSAR).toLocaleString('id-ID')}`}</td>
      ${payCells('buy')}
    </tr>
    <tr>
      <td style="${CELL};font-weight:900;background:#eaf7ee">SELL</td>
      <td style="${CELL};background:#eaf7ee">${mode === 'template' ? '[YYYY-MM-DD]' : fmtDateInput(b!.checkInDate)}</td>
      <td style="${CELL};background:#eaf7ee">${mode === 'template' ? '[YYYY-MM-DD]' : fmtDateInput(b!.checkOutDate)}</td>
      <td style="${CELL};text-align:center;background:#eaf7ee">${nights}</td>
      ${sellCells}
      <td style="${CELL};text-align:center;background:#eaf7ee">${b?.rooms[0]?.mealPlan || 'FB'}</td>
      <td style="${CELL};text-align:center;background:#eaf7ee">-</td>
      <td style="${CELL};text-align:center;background:#eaf7ee">${transportSell}</td>
      <td style="${CELL};text-align:right;background:#eaf7ee;font-weight:bold">${mode === 'template' ? '[auto]' : `SAR ${Math.round(b!.totalSellSAR).toLocaleString('id-ID')}`}</td>
      ${payCells('sell')}
    </tr>
    <tr><td colspan="30" style="height:10px"></td></tr>`;
  }).join('');

  const COL_W = [16, 66, 66, 28, 26, 40, 26, 40, 26, 40, 26, 40, 26, 40, 26, 40, 34, 18, 42, 66, 54, 32, 54, 32, 54, 32, 54, 32, 54, 32];
  const colgroup = `<colgroup>${COL_W.map((w) => `<col width="${w}"/>`).join('')}</colgroup>`;

  return `<table border="0" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed">
    ${colgroup}
    <tr><td colspan="30" style="background:#f97316;color:#fff;font-size:13px;font-weight:900;text-align:center;padding:6px;letter-spacing:0.5px">&#128203; ${mode === 'template' ? 'TEMPLATE INPUT DATA BOOKING' : 'DATA BOOKING &amp; REPORT'} &mdash; ${legal.toUpperCase()}</td></tr>
    <tr><td colspan="30" style="text-align:center;font-size:9px;font-style:italic;padding:3px;border-bottom:2px solid #f97316">${
      mode === 'template'
        ? 'Isi kolom-kolom di bawah ini, lalu import ke aplikasi Hotel Booking Profitability Dashboard'
        : `Dicetak ${new Date().toLocaleString('id-ID')} &middot; ${bookings.length} booking &middot; kolom [auto] dihitung sistem`
    }</td></tr>
    <tr><td colspan="30" style="height:8px"></td></tr>
    ${blocks}
    <tr><td colspan="30" style="background:#fdf3c0;border:2px solid #e5d9a8;padding:6px 8px;font-size:9px;color:#713f12">
      <b>&#128221; PETUNJUK PENGISIAN:</b><br/>
      1. <b>BUY</b> = Modal/Harga dari Vendor &nbsp;|&nbsp; <b>SELL</b> = Harga Jual ke Customer<br/>
      2. Format tanggal: <b>YYYY-MM-DD</b> (contoh: 2026-04-08)<br/>
      3. Kolom <b>Total Night</b> &amp; <b>Total Tagihan SAR</b> akan dihitung otomatis sistem<br/>
      4. Tipe kamar: DBL (Double), TRP (Triple), QRD (Quad), QNT (Quintuple), BED (Extra Bed), EXT (Extension)<br/>
      5. <b>Kurs</b> = nilai tukar IDR per 1 SAR pada tanggal transaksi
    </td></tr>
  </table>`;
}

function downloadStyledXls(html: string, filename: string) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Booking</x:Name><x:WorksheetOptions><x:DisplayGridlines/><x:Print><x:ValidPrinterInfo/><x:PaperSizeIndex>9</x:PaperSizeIndex><x:Landscape/><x:FitWidth>1</x:FitWidth><x:FitHeight>0</x:FitHeight></x:Print></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${html}</body></html>`;
  const blob = new Blob(['\ufeff', doc], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadBookingTemplate(settings: CompanySettings) {
  downloadStyledXls(buildTemplateHtml('template', [], settings), 'TEMPLATE_INPUT_DATA_BOOKING_TAMIMA');
}

export function exportBookingsTemplateXls(bookings: Booking[], settings: CompanySettings, filename = 'TAMIMA_Data_Booking_Report') {
  downloadStyledXls(buildTemplateHtml('data', bookings, settings), filename);
}

/* ============ LEGACY "REKAP MULTI-BOOKING" FORMAT (combined Q/R cells) ============ */

export function buildLegacyRekapHtml(mode: 'template' | 'data', bookings: Booking[], settings: CompanySettings): string {
  const legal = settings.legalEntityName || 'PT. TAMIMA JAYA WISATA';
  const NAVY2 = 'background:#1f3864;color:#fff;font-size:8px;font-weight:bold;text-align:center;padding:4px 3px;border:1px solid #16294a';
  const CEL = 'font-size:8.5px;padding:3px 4px;border:1px solid #cbd5e1;text-align:center';

  const list = mode === 'data' ? bookings : [];
  const sum = (f: (b: Booking) => number) => list.reduce((s, b) => s + f(b), 0);
  const kpi = [
    { label: 'TOTAL MODAL (BUY)', val: sum((b) => b.totalCostIDR), border: '#dc2626', bg: '#fdeaea', color: '#b91c1c' },
    { label: 'TOTAL REVENUE (SELL)', val: sum((b) => b.totalSellIDR), border: '#16a34a', bg: '#eaf7ee', color: '#15803d' },
    { label: 'TOTAL NET PROFIT', val: sum((b) => b.profitIDR), border: '#ca8a04', bg: '#fdf6d8', color: '#a16207' },
    { label: 'TOTAL DITERIMA', val: sum((b) => b.amountPaidIDR), border: '#2563eb', bg: '#dbeafe', color: '#1d4ed8' },
    { label: 'TOTAL SISA', val: sum((b) => b.totalSellIDR - b.amountPaidIDR), border: '#ea580c', bg: '#ffedd5', color: '#c2410c' },
  ];

  const statusTxt = (b: Booking) =>
    b.status === 'Paid' ? '✓ LUNAS' : b.status === 'Partial' ? 'PARTIAL' : b.status === 'Draft' ? 'DRAFT' : 'BELUM LUNAS';

  const ROOMS2: { code: string; label: string }[] = [
    { code: 'DBL', label: 'Double' },
    { code: 'TRP', label: 'Triple' },
    { code: 'QRD', label: 'Quad' },
    { code: 'QNT', label: 'Quint' },
    { code: 'BED', label: 'Bed' },
    { code: 'EXT', label: 'Extra' },
  ];

  const blocks = list
    .map((b, i) => {
      const roomOf = (label: string) => b.rooms.find((r) => r.roomType === label);
      const qr = (label: string, side: 'buy' | 'sell') => {
        const r = roomOf(label);
        if (!r) return `0/0`;
        return `${r.numberOfRooms}/${Math.round(side === 'buy' ? r.costPerNight : r.sellPerNight)}`;
      };
      const cells = (side: 'buy' | 'sell') =>
        ROOMS2.map((r) => `<td style="${CEL};background:${side === 'buy' ? '#fdeaea' : '#eaf7ee'}">${qr(r.label, side)}</td>`).join('');
      const trans = (side: 'buy' | 'sell') =>
        Math.round(b.additionalServices.reduce((s, x) => s + (side === 'buy' ? x.cost : x.sell), 0));
      const meal = b.rooms[0]?.mealPlan || 'FB';
      const periode = `${new Date(b.checkInDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} → ${new Date(b.checkOutDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} (${b.totalNights}M)`;
      return `
      <tr><td colspan="14" style="background:#fdf3c0;border:1px solid #e5d9a8;font-size:8.5px;font-weight:bold;padding:3px 5px">
        &#128203; BOOKING #${i + 1} &nbsp;|&nbsp; <b>Hotel:</b> ${b.hotelName} &nbsp;|&nbsp; <b>Customer:</b> ${b.travelCompany || b.customerName} &nbsp;|&nbsp; <b>Vendor:</b> ${b.vendorName || '-'} &nbsp;|&nbsp; <b>PIC:</b> ${b.vendorPic || '-'} &nbsp;|&nbsp; <b>Sales:</b> ${b.staffName} &nbsp;|&nbsp; <b>Periode:</b> ${periode} &nbsp;|&nbsp; <b>Status:</b> ${statusTxt(b)} &nbsp;|&nbsp; <b>NET PROFIT:</b> IDR ${Math.round(b.profitIDR).toLocaleString('id-ID')} (${b.profitMarginPercent.toFixed(2)}%)
      </td></tr>
      <tr>
        <th style="${NAVY2}">Type</th>
        ${ROOMS2.map((r) => `<th style="${NAVY2}">${r.code} Q/R</th>`).join('')}
        <th style="${NAVY2}">Meal</th><th style="${NAVY2}">VAT</th><th style="${NAVY2}">Trans</th>
        <th style="${NAVY2}">Total SAR</th><th style="${NAVY2}">IDR Masuk</th><th style="${NAVY2}">Sisa IDR</th><th style="${NAVY2}">Total IDR Aktual</th>
      </tr>
      <tr>
        <td style="${CEL};font-weight:900;background:#fdeaea">BUY</td>
        ${cells('buy')}
        <td style="${CEL};background:#fdeaea">${meal}</td><td style="${CEL};background:#fdeaea">-</td>
        <td style="${CEL};background:#fdeaea">${trans('buy')}</td>
        <td style="${CEL};background:#fdeaea;font-weight:bold">SAR ${Math.round(b.totalCostSAR).toLocaleString('id-ID')}</td>
        <td style="${CEL};background:#fdeaea">${Math.round(b.vendorPayments?.reduce((s, p) => s + p.amountIDR, 0) || 0).toLocaleString('id-ID')}</td>
        <td style="${CEL};background:#fdeaea">${Math.round(b.totalCostIDR - (b.vendorPayments?.reduce((s, p) => s + p.amountIDR, 0) || 0)).toLocaleString('id-ID')}</td>
        <td style="${CEL};background:#fdeaea;font-weight:bold">${Math.round(b.totalCostIDR).toLocaleString('id-ID')}</td>
      </tr>
      <tr>
        <td style="${CEL};font-weight:900;background:#eaf7ee">SELL</td>
        ${cells('sell')}
        <td style="${CEL};background:#eaf7ee">${meal}</td><td style="${CEL};background:#eaf7ee">-</td>
        <td style="${CEL};background:#eaf7ee">${trans('sell')}</td>
        <td style="${CEL};background:#eaf7ee;font-weight:bold">SAR ${Math.round(b.totalSellSAR).toLocaleString('id-ID')}</td>
        <td style="${CEL};background:#eaf7ee">${Math.round(b.amountPaidIDR).toLocaleString('id-ID')}</td>
        <td style="${CEL};background:#eaf7ee">${Math.round(b.totalSellIDR - b.amountPaidIDR).toLocaleString('id-ID')}</td>
        <td style="${CEL};background:#eaf7ee;font-weight:bold">${Math.round(b.totalSellIDR).toLocaleString('id-ID')}</td>
      </tr>
      <tr><td colspan="14" style="height:8px"></td></tr>`;
    })
    .join('');

  const tplRow = `
    <tr>
      <td style="${CEL};font-weight:900;background:#fdeaea">BUY</td>
      ${Array.from({ length: 6 }, () => `<td style="${CEL};background:#fdeaea">0/0</td>`).join('')}
      <td style="${CEL};background:#fdeaea">FB</td><td style="${CEL};background:#fdeaea">-</td><td style="${CEL};background:#fdeaea">0</td>
      <td style="${CEL};background:#fdeaea;font-weight:bold">[auto]</td><td style="${CEL};background:#fdeaea">0</td><td style="${CEL};background:#fdeaea">0</td><td style="${CEL};background:#fdeaea;font-weight:bold">0</td>
    </tr>
    <tr>
      <td style="${CEL};font-weight:900;background:#eaf7ee">SELL</td>
      ${Array.from({ length: 6 }, () => `<td style="${CEL};background:#eaf7ee">0/0</td>`).join('')}
      <td style="${CEL};background:#eaf7ee">FB</td><td style="${CEL};background:#eaf7ee">-</td><td style="${CEL};background:#eaf7ee">0</td>
      <td style="${CEL};background:#eaf7ee;font-weight:bold">[auto]</td><td style="${CEL};background:#eaf7ee">0</td><td style="${CEL};background:#eaf7ee">0</td><td style="${CEL};background:#eaf7ee;font-weight:bold">0</td>
    </tr>`;

  const metaRow =
    mode === 'template'
      ? `<tr><td colspan="14" style="background:#fdf3c0;border:1px solid #e5d9a8;font-size:8.5px;font-weight:bold;padding:3px 5px">
        &#128203; BOOKING #1 &nbsp;|&nbsp; <b>Hotel:</b> [isi nama hotel] &nbsp;|&nbsp; <b>Customer:</b> [isi nama customer] &nbsp;|&nbsp; <b>Vendor:</b> [isi nama vendor] &nbsp;|&nbsp; <b>PIC:</b> [isi PIC] &nbsp;|&nbsp; <b>Sales:</b> [isi sales] &nbsp;|&nbsp; <b>Periode:</b> [YYYY-MM-DD] → [YYYY-MM-DD] ([n]M) &nbsp;|&nbsp; <b>Status:</b> [BELUM LUNAS]
      </td></tr>
      <tr>
        <th style="${NAVY2}">Type</th>
        ${ROOMS2.map((r) => `<th style="${NAVY2}">${r.code} Q/R</th>`).join('')}
        <th style="${NAVY2}">Meal</th><th style="${NAVY2}">VAT</th><th style="${NAVY2}">Trans</th>
        <th style="${NAVY2}">Total SAR</th><th style="${NAVY2}">IDR Masuk</th><th style="${NAVY2}">Sisa IDR</th><th style="${NAVY2}">Total IDR Aktual</th>
      </tr>${tplRow}`
      : '';

  return `<table border="0" cellspacing="0" cellpadding="0" style="width:100%">
    <tr><td colspan="14" style="text-align:center;font-size:13px;font-weight:900;padding:5px">DATABASE LAPORAN INTERNAL &mdash; REKAP MULTI-BOOKING</td></tr>
    <tr><td colspan="14" style="text-align:center;font-size:10px;font-weight:bold">${legal}</td></tr>
    <tr><td colspan="14" style="text-align:center;font-size:9px">Semua Status Booking</td></tr>
    <tr><td colspan="14" style="text-align:center;font-size:9px;color:#dc2626;font-weight:bold;border-top:2px solid #f97316;border-bottom:2px solid #f97316;padding:3px">&#128274; LAPORAN INTERNAL &mdash; RAHASIA PERUSAHAAN</td></tr>
    <tr>
      ${kpi
        .map(
          (k) =>
            `<td colspan="${Math.floor(14 / 5)}" style="border:2px solid ${k.border};background:${k.bg};text-align:center;padding:5px"><div style="font-size:8px;font-weight:bold;color:${k.color}">${k.label}</div><div style="font-size:12px;font-weight:900;color:${k.color}">IDR ${Math.round(k.val).toLocaleString('id-ID')}</div></td>`
        )
        .join('')}
      <td colspan="2"></td>
    </tr>
    <tr><td colspan="14" style="height:8px"></td></tr>
    ${mode === 'template' ? metaRow : blocks}
    <tr><td colspan="14" style="background:#dbeafe;border:1px solid #93c5fd;font-size:8.5px;color:#1e3a8a;padding:4px 6px">&#128274; <b>INFO:</b> Dokumen ini berisi data finansial internal perusahaan termasuk modal vendor dan margin profit. <b>TIDAK BOLEH</b> disebarkan ke customer.</td></tr>
    <tr>
      <td colspan="8" style="font-size:8px;font-style:italic;padding:4px">Dicetak otomatis pada ${new Date().toLocaleString('id-ID')}</td>
      <td colspan="6" style="text-align:center;font-size:8px;padding:4px">Tertanda,<br/><br/><b>( ${(settings.bookingManagerName || 'GHOFAR').toUpperCase()} )</b></td>
    </tr>
  </table>`;
}

export function downloadLegacyRekapTemplate(settings: CompanySettings) {
  downloadStyledXls(buildLegacyRekapHtml('template', [], settings), 'TEMPLATE_REKAP_MULTI_BOOKING_TAMIMA');
}

export function exportLegacyRekapXls(bookings: Booking[], settings: CompanySettings, filename = 'TAMIMA_Rekap_Multi_Booking') {
  downloadStyledXls(buildLegacyRekapHtml('data', bookings, settings), filename);
}

/* ============================ PARSER ============================ */

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, '').toUpperCase();
const num = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const parseISO = (v: unknown): string => {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return '';
};

/**
 * Strict detection for the NEW "TEMPLATE INPUT DATA BOOKING" format only
 * (METADATA TRANSAKSI header or split DBL Qty/Rate columns).
 * Legacy REKAP MULTI-BOOKING blocks (combined "DBL Q/R" + BUY/SELL rows)
 * must NOT match here — they are handled by the master block parser.
 */
export function detectTemplateFormat(aoa: unknown[][]): boolean {
  return aoa.some((row) =>
    row.some((c) => {
      const n = norm(c);
      return n.includes('METADATATRANSAKSI') || n === 'DBLQTY' || n === 'DBLQTYRATE';
    })
  );
}

/** Parse the uploaded template into Booking records, applying the app's hotel-rate formulas */
export function parseBookingTemplate(aoa: unknown[][], fallbackRate: number): Booking[] {
  const out: Booking[] = [];
  for (let i = 0; i < aoa.length; i++) {
    const first = norm(aoa[i]?.[0]);
    if (first !== 'BUY') continue;

    // metadata row is two rows above BUY (metadata header + values)
    const metaRow = (aoa[i - 1] as unknown[]) || [];
    const get = (label: string) => {
      const idx = metaRow.findIndex((c) => norm(c).startsWith(label));
      return idx >= 0 ? String(metaRow[idx + 1] ?? '').trim() : '';
    };
    const hotel = get('HOTEL:');
    if (!hotel) continue;

    // header row is the row just above BUY
    const hdr = (aoa[i - 1 - 1] as unknown[]) || [];
    // header may be 2 rows (grouped); search both current-1 and current-2 for DBL
    let hdrRow = hdr;
    if (!hdrRow.some((c) => norm(c).startsWith('DBL'))) hdrRow = (aoa[i - 1] as unknown[]) || [];
    const col = (key: string) => hdrRow.findIndex((c) => norm(c).startsWith(key));

    const buy = aoa[i] as unknown[];
    const sell = (aoa[i + 1] as unknown[]) || [];

    const checkIn = parseISO(buy[col('CHECKIN')] ?? buy[1]);
    const checkOut = parseISO(buy[col('CHECKOUT')] ?? buy[2]);
    let nights = checkIn && checkOut ? Math.round((+new Date(checkOut) - +new Date(checkIn)) / 86400000) : 1;
    if (nights <= 0) nights = 1;

    const rooms = ROOM_COLS.map((r) => {
      const qIdx = col(`${r.code}QTY`);
      const rIdx = col(`${r.code}RATE`);
      const qty = num(sell[qIdx] ?? buy[qIdx]);
      const sellRate = num(sell[rIdx]);
      const buyRate = num(buy[rIdx]);
      return qty > 0 ? { id: `r-${r.code}`, roomType: r.label, numberOfRooms: qty, costPerNight: buyRate, sellPerNight: sellRate, mealPlan: (String(sell[col('MEALPLAN')] || buy[col('MEALPLAN')] || 'FB').trim() || 'FB') as Booking['rooms'][number]['mealPlan'] } : null;
    }).filter(Boolean) as Booking['rooms'];

    const transportBuy = num(buy[col('TRANSPORT')]);
    const transportSell = num(sell[col('TRANSPORT')]);
    const additionalServices =
      transportSell > 0 || transportBuy > 0
        ? [{ id: 'tr-1', description: 'Transport', cost: transportBuy, sell: transportSell }]
        : [];

    // Apply hotel-rate formula: Σ qty × rate × nights (+ transport)
    const totalCostSAR = rooms.reduce((s, r) => s + r.numberOfRooms * r.costPerNight * nights, 0) + transportBuy;
    const totalSellSAR = rooms.reduce((s, r) => s + r.numberOfRooms * r.sellPerNight * nights, 0) + transportSell;

    // Payments 1..5 from SELL row (IDR + Kurs per termin)
    const paymentHistory: PaymentRecord[] = [];
    for (let p = 1; p <= 5; p++) {
      const idrIdx = col(`PEMBAYARAN${p}IDR`) >= 0 ? col(`PEMBAYARAN${p}IDR`) : hdrRow.findIndex((c) => norm(c) === 'IDR' && hdrRow.slice(0, hdrRow.indexOf(c)).filter((x) => norm(x).startsWith('PEMBAYARAN')).length === p - 1);
      const kursIdx = idrIdx + 1;
      const idr = num(sell[idrIdx]);
      const kurs = num(sell[kursIdx]) || fallbackRate;
      if (idr > 0) {
        paymentHistory.push({
          id: `ph-${p}`,
          date: new Date().toISOString(),
          amountSAR: Math.round((idr / (kurs || fallbackRate)) * 100) / 100,
          amountIDR: idr,
          exchangeRate: kurs,
          method: 'Bank Transfer (BCA/Mandiri)',
          reference: `TERM-${p}`,
          note: `Pembayaran ${p}`,
        });
      }
    }

    const paidSAR = paymentHistory.reduce((s, p) => s + p.amountSAR, 0);
    const paidIDR = paymentHistory.reduce((s, p) => s + p.amountIDR, 0);
    const rate = paymentHistory[paymentHistory.length - 1]?.exchangeRate || fallbackRate;
    const status: Booking['status'] = paidSAR >= totalSellSAR - 0.5 && paidSAR > 0 ? 'Paid' : paidSAR > 0 ? 'Partial' : 'Unpaid';

    out.push({
      id: `b-${Date.now()}-${out.length}`,
      bookingRef: generateInvoiceRef(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status,
      staffName: get('SALESPERSON:') || get('SALES:') || 'Sales',
      bookingType: 'Group',
      travelCompany: get('CUSTOMER:') || undefined,
      vendorName: get('VENDOR:') || undefined,
      vendorPic: get('PICINTERNAL:') || undefined,
      customerName: get('CUSTOMER:') || '-',
      customerPhone: '',
      customerEmail: '',
      customerPassport: '',
      customerCountry: 'Indonesia',
      groupSize: { adults: rooms.reduce((s, r) => s + r.numberOfRooms * 2, 0) || 1, children: 0, infants: 0 },
      notes: 'Import template Excel',
      hotelName: hotel,
      hotelCity: 'Makkah',
      starRating: 5,
      checkInDate: checkIn || new Date().toISOString().slice(0, 10),
      checkOutDate: checkOut || new Date().toISOString().slice(0, 10),
      totalNights: nights,
      inputCurrency: 'SAR',
      exchangeRate: rate,
      rooms,
      additionalServices,
      totalCostSAR,
      totalSellSAR,
      totalCostIDR: Math.round(totalCostSAR * rate),
      totalSellIDR: Math.round(totalSellSAR * rate),
      profitSAR: Math.round((totalSellSAR - totalCostSAR) * 100) / 100,
      profitIDR: Math.round((totalSellSAR - totalCostSAR) * rate),
      profitMarginPercent: totalSellSAR > 0 ? ((totalSellSAR - totalCostSAR) / totalSellSAR) * 100 : 0,
      amountPaidSAR: Math.round(paidSAR * 100) / 100,
      amountPaidIDR: Math.round(paidIDR),
      paymentExchangeRate: rate,
      paymentMethod: 'Bank Transfer (BCA/Mandiri)',
      dueDate: checkIn || '',
      paymentHistory,
    });
  }
  return out;
}
