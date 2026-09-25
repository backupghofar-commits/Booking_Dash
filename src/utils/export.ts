import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Booking, CompanySettings, PaymentRecord } from '../types/booking';
import { formatSAR, formatIDR } from './currency';
import { averageTransactionRate } from './exchangeRate';

const idNum = (n: number, decimals = 0) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n || 0);

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * Generate PDF document from any captured HTML element
 */
export async function exportVoucherToPDF(elementId: string, filename: string): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) return false;

  try {
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating PDF:', err);
    return false;
  }
}

/**
 * Export booking Confirmation Letter to Word (.doc) — mirrors the orange/navy design
 */
export function exportVoucherToWord(booking: Booking, settings: CompanySettings) {
  const brand = {
    legalName: settings.legalEntityName || 'PT. TAMIMA JAYA WISATA',
    tagline: settings.tagline || 'Beyond LA & Handling Service · Hajj & Umrah Specialist',
    address: settings.indonesiaAddress || settings.address,
    wa: settings.waPhone || settings.phone,
    manager: (settings.bookingManagerName || booking.staffName || 'GHOFAR').toUpperCase(),
    managerRole: settings.bookingManagerRole || 'Booking Manager',
    bookingPolicy: settings.bookingPolicy || [],
    cancellationPolicy: settings.cancellationPolicy || [],
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
  const balanceIDR = booking.totalSellIDR - booking.amountPaidIDR;
  const statusLabel =
    booking.status === 'Paid'
      ? 'FULL PAYMENT'
      : booking.status === 'Partial'
        ? 'PARTIAL PAYMENT'
        : booking.status === 'Unpaid'
          ? 'UNPAID / PENDING'
          : booking.status.toUpperCase();

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Confirmation Letter - ${booking.bookingRef}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 24px; color: #0f172a; font-size: 11px; }
      h1 { color: #ea580c; font-size: 22px; margin: 0; }
      .tag { font-style: italic; color: #475569; margin: 2px 0; }
      .cl-box { background: #f97316; color: #fff; padding: 8px 16px; text-align: center; float: right; }
      .cl-box b { font-size: 16px; letter-spacing: 1px; }
      .meta { text-align: right; clear: both; margin-top: 4px; }
      .badge { display: inline-block; background: #fcd34d; border: 1px solid #f59e0b; padding: 2px 8px; font-weight: bold; font-size: 10px; }
      table.info { border-collapse: collapse; width: 48%; display: inline-block; vertical-align: top; }
      table.info th { color: #fff; text-align: left; padding: 5px 8px; font-size: 10px; letter-spacing: 1px; }
      table.info td { border: 1px solid #cbd5e1; padding: 4px 8px; }
      .navy { background: #0f172a; } .orange { background: #f97316; }
      .stats td { border: 1px solid #fdba74; background: #fff7ed; text-align: center; padding: 6px; }
      .stats .lbl { color: #ea580c; font-size: 8px; font-weight: bold; letter-spacing: 1px; }
      .stats .val { font-size: 15px; font-weight: 900; }
      table.rooms { border-collapse: collapse; width: 100%; margin-top: 8px; }
      table.rooms th { background: #f1f5f9; color: #475569; font-size: 9px; padding: 5px 8px; text-align: left; }
      table.rooms td { border: 1px solid #e2e8f0; padding: 5px 8px; }
      .gt { background: #f97316; color: #fff; font-weight: 900; padding: 6px 10px; }
      .idr { background: #0f172a; color: #fff; font-weight: bold; padding: 5px 10px; }
      .box td { border: 2px solid; text-align: center; padding: 6px; font-weight: bold; width: 25%; }
      .green { border-color: #34d399; background: #ecfdf5; color: #047857; }
      .blue { border-color: #60a5fa; background: #eff6ff; color: #1d4ed8; }
      .orng { border-color: #fb923c; background: #fff7ed; color: #ea580c; }
      .red { border-color: #f87171; background: #fef2f2; color: #dc2626; }
      .pol { display: inline-block; width: 48%; vertical-align: top; border: 1px solid; padding: 6px 10px; font-size: 9.5px; }
      .note { background: #fef3c7; border: 2px solid #fbbf24; padding: 6px 10px; margin-top: 10px; }
      .foot { background: #0f172a; color: #fff; text-align: center; padding: 6px; margin-top: 16px; font-size: 9px; letter-spacing: 1px; }
    </style></head>
    <body>
      <div class='cl-box'><b>CONFIRMATION LETTER</b><br/><span style='font-size:9px'>of Hotel booking</span></div>
      ${settings.logoUrl ? `<p style='margin:0'><img src='${settings.logoUrl}' style='height:44px;object-fit:contain'/></p>` : ''}
      <p style='color:#ea580c;font-size:8px;font-weight:bold;letter-spacing:2px;margin:0'>ISSUED BY</p>
      <h1>${brand.legalName}</h1>
      <p class='tag'>${brand.tagline}</p>
      <p style='font-size:9px;margin:2px 0'>&#128205; ${brand.address}<br/>&#128222; WA: ${brand.wa}</p>
      <div class='meta'>
        Invoice Ref: <b style='color:#ea580c'>${booking.bookingRef}</b><br/>
        Date Issued: <b>${longDate(booking.createdAt)}</b><br/>
        <span class='badge'>${statusLabel}</span>
      </div>
      <p style='clear:both;margin-top:14px'>Dear <b>${booking.customerName.toUpperCase()}</b>, we are pleased to confirm your hotel booking with the following details. Please present this letter at check-in.</p>

      <table class='info'><tr><th class='navy' colspan='2'>&#128100; GUEST INFORMATION &mdash; ${booking.bookingType === 'Group' ? 'GROUP' : 'PRIVATE'}</th></tr>
        ${
          booking.bookingType === 'Group'
            ? `<tr><td style='color:#64748b;width:40%'>Travel Company</td><td><b>${booking.travelCompany || '-'}</b></td></tr>
        <tr><td style='color:#64748b'>Lead Contact</td><td>${booking.customerName}</td></tr>`
            : `<tr><td style='color:#64748b;width:40%'>Lead Guest</td><td><b>${booking.customerName}</b></td></tr>
        <tr><td style='color:#64748b'>Passport / ID</td><td>${booking.customerPassport || '-'}</td></tr>`
        }
        <tr><td style='color:#64748b'>Phone / WA</td><td>${booking.customerPhone || '-'}</td></tr>
        <tr><td style='color:#64748b'>No. of Pax</td><td><b>${totalPax} Pax</b></td></tr>
      </table>
      <table class='info' style='float:right'><tr><th class='orange' colspan='2'>&#127976; HOTEL INFORMATION</th></tr>
        <tr><td style='color:#64748b;width:30%'>Hotel</td><td><b>${booking.hotelName}</b></td></tr>
        <tr><td style='color:#64748b'>City</td><td>${booking.hotelCity}</td></tr>
        <tr><td style='color:#64748b'>Address</td><td>${['Makkah','Madina','Jeddah','Riyadh'].includes(booking.hotelCity) ? 'Saudi Arabia' : 'Indonesia'}</td></tr>
        <tr><td style='color:#64748b'>Meal</td><td>${booking.rooms[0]?.mealPlan || 'Breakfast'}</td></tr>
      </table>

      <table class='stats' style='width:100%;border-collapse:collapse;margin-top:10px'><tr>
        <td><span class='lbl'>CHECK-IN</span><br/><span class='val'>${booking.checkInDate}</span><br/><span style='font-size:8px;color:#64748b'>From 16:00</span></td>
        <td><span class='lbl'>CHECK-OUT</span><br/><span class='val'>${booking.checkOutDate}</span><br/><span style='font-size:8px;color:#64748b'>Before 14:00</span></td>
        <td><span class='lbl'>DURATION</span><br/><span class='val' style='color:#ea580c'>${booking.totalNights} Nights</span><br/><span style='font-size:8px;color:#64748b'>Total Stay</span></td>
        <td><span class='lbl'>TOTAL ROOMS</span><br/><span class='val' style='color:#ea580c'>${totalRooms}</span><br/><span style='font-size:8px;color:#64748b'>Booked</span></td>
      </tr></table>

      <p style='font-weight:900;letter-spacing:1px;margin:12px 0 4px'>&#128716; ROOM RESERVATION DETAILS</p>
      <table class='rooms'>
        <tr><th>ROOM TYPE</th><th>QTY</th><th>NIGHTS</th><th style='text-align:right'>RATE/NIGHT</th><th style='text-align:right'>SUBTOTAL (SAR)</th></tr>
        ${booking.rooms
          .map(
            (r) => `<tr><td><b>${r.roomType}</b></td><td>${r.numberOfRooms} Room(s)</td><td>${booking.totalNights}</td><td style='text-align:right'>SAR ${idNum(r.sellPerNight)}</td><td style='text-align:right'><b>SAR ${idNum(r.sellPerNight * r.numberOfRooms * booking.totalNights)}</b></td></tr>`
          )
          .join('')}
        ${booking.additionalServices
          .map(
            (s) => `<tr style='background:#f0f9ff'><td>&#128663; ${s.description}</td><td>-</td><td>-</td><td style='text-align:right'>-</td><td style='text-align:right'><b>SAR ${idNum(s.sell)}</b></td></tr>`
          )
          .join('')}
      </table>
      <div class='gt'>GRAND TOTAL <span style='float:right'>SAR ${idNum(booking.totalSellSAR)}</span></div>
      <div class='idr'>EQUIVALENT IN IDR (EST. RATE: ${idNum(rate)}) <span style='float:right'>IDR ${idNum(booking.totalSellIDR)}</span></div>

      <table style='width:100%;border-collapse:separate;border-spacing:6px 0;margin-top:8px'><tr>
        <td class='box green'>TOTAL AMOUNT<br/>IDR ${idNum(booking.totalSellIDR)}<br/><span style='font-size:8px'>&#8776; SAR ${idNum(booking.totalSellSAR)}</span></td>
        <td class='box blue'>AMOUNT PAID<br/>IDR ${idNum(booking.amountPaidIDR)}<br/><span style='font-size:8px'>&#8776; SAR ${idNum(booking.amountPaidSAR, 2)} &middot; Kurs ${idNum(booking.paymentExchangeRate || rate)}</span></td>
        <td class='box orng'>BALANCE (SAR)<br/>SAR ${idNum(balanceSAR, 2)}<br/><span style='font-size:8px'>Mata Uang Asal</span></td>
        <td class='box red'>OUTSTANDING<br/>IDR ${idNum(balanceIDR)}<br/><span style='font-size:8px'>Kurs Est: ${idNum(rate)}</span></td>
      </tr></table>

      <div style='margin-top:8px;border:2px solid #0f172a;padding:6px 10px'>
        <span style='background:${booking.status === 'Paid' ? '#10b981' : booking.status === 'Partial' ? '#fbbf24' : '#f43f5e'};color:${booking.status === 'Partial' ? '#451a03' : '#fff'};font-weight:900;font-size:9px;letter-spacing:1px;padding:2px 8px'>${statusLabel}</span>
        <span style='font-size:9px;font-weight:bold;color:#64748b;margin-left:8px'>STATUS PEMBAYARAN CUSTOMER KEPADA TAMIMA &mdash; ${booking.amountPaidIDR > 0 ? Math.min(100, Math.round((booking.amountPaidIDR / (booking.totalSellIDR || 1)) * 100)) : 0}% DITERIMA</span>
        <div style='margin-top:5px;height:7px;background:#e2e8f0;border:1px solid #cbd5e1'><div style='height:100%;width:${booking.amountPaidIDR > 0 ? Math.min(100, Math.round((booking.amountPaidIDR / (booking.totalSellIDR || 1)) * 100)) : 0}%;background:${booking.status === 'Paid' ? '#10b981' : booking.status === 'Partial' ? '#fbbf24' : '#f43f5e'}'></div></div>
        <p style='font-size:8px;color:#94a3b8;font-style:italic;margin:4px 0 0'>Customer document &mdash; data pembayaran TAMIMA ke vendor bersifat rahasia dan tidak ditampilkan.</p>
      </div>

      <div style='margin-top:10px'>
        <div class='pol' style='border-color:#6ee7b7;background:#ecfdf5'><b style='color:#047857'>&#128203; BOOKING POLICY</b><ul style='margin:4px 0;padding-left:16px'>${brand.bookingPolicy.map((p) => `<li>${p}</li>`).join('')}</ul></div>
        <div class='pol' style='border-color:#fca5a5;background:#fef2f2;float:right'><b style='color:#dc2626'>&#9888; CANCELLATION POLICY</b><ul style='margin:4px 0;padding-left:16px'>${brand.cancellationPolicy.map((p) => `<li>${p}</li>`).join('')}</ul></div>
      </div>

      <div class='note' style='clear:both'><b style='background:#fcd34d;padding:2px 6px;font-size:9px'>&#128179; NOTE / PAYMENT</b> &nbsp; Pembayaran melalui akun <b style='color:#1d4ed8'>Bank Mandiri</b> a/n <b>${brand.mandiriName}</b> &middot; No. Rek. <b style='border:1px solid #3b82f6;padding:1px 6px;color:#1d4ed8'>${brand.mandiriNumber}</b></div>

      <table style='width:100%;margin-top:14px'><tr>
        <td style='font-size:9px;color:#475569'>Thank you for choosing <b style='color:#ea580c'>${brand.legalName}</b> as your trusted Hajj &amp; Umrah travel partner.<br/><i>System-generated confirmation &middot; No physical signature required</i></td>
        <td style='text-align:center;width:30%'>Authorized Signature,<br/>${settings.stampUrl ? `<img src='${settings.stampUrl}' style='width:80px;height:80px;object-fit:contain;opacity:0.92'/><br/>` : '<br/><br/>'}<b>( ${brand.manager} )</b><br/><span style='font-size:9px;color:#64748b'>${brand.managerRole}</span></td>
      </tr></table>

      <div class='foot'>${brand.legalName.toUpperCase()} &middot; ${brand.tagline.toUpperCase()} &middot; ${booking.bookingRef}</div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Confirmation_Letter_${booking.bookingRef}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export single booking or all bookings to Excel (.xlsx)
 */
export function exportBookingsToExcel(bookings: Booking[], filename: string = 'TAMIMA_Bookings_Report') {
  const data = bookings.map((b) => ({
    'Invoice Ref': b.bookingRef,
    'Status': b.status,
    'Booking Date': new Date(b.createdAt).toLocaleDateString(),
    'Customer Name': b.customerName,
    'Phone': b.customerPhone,
    'Country': b.customerCountry,
    'Hotel Name': b.hotelName,
    'City': b.hotelCity,
    'Check-In': b.checkInDate,
    'Check-Out': b.checkOutDate,
    'Nights': b.totalNights,
    'Cost (SAR)': Math.round(b.totalCostSAR * 100) / 100,
    'Sell Price (SAR)': Math.round(b.totalSellSAR * 100) / 100,
    'Profit (SAR)': Math.round(b.profitSAR * 100) / 100,
    'Profit Margin (%)': b.profitMarginPercent.toFixed(2) + '%',
    'Paid (SAR)': Math.round(b.amountPaidSAR * 100) / 100,
    'Balance (SAR)': Math.round((b.totalSellSAR - b.amountPaidSAR) * 100) / 100,
    'Cost (IDR)': Math.round(b.totalCostIDR),
    'Sell Price (IDR)': Math.round(b.totalSellIDR),
    'Profit (IDR)': Math.round(b.profitIDR),
    'Paid (IDR)': Math.round(b.amountPaidIDR),
    'Balance (IDR)': Math.round(b.totalSellIDR - b.amountPaidIDR),
    'Payment Method': b.paymentMethod,
    'Staff': b.staffName,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Resolve payment history records for a booking (synthesises one from totals if none saved)
 */
export function resolvePaymentHistory(b: Booking): PaymentRecord[] {
  if (b.paymentHistory && b.paymentHistory.length > 0) return b.paymentHistory;
  if (b.amountPaidSAR > 0) {
    return [
      {
        id: `${b.id}-syn`,
        date: b.updatedAt || b.createdAt,
        amountSAR: b.amountPaidSAR,
        amountIDR: b.amountPaidIDR,
        method: b.paymentMethod,
        reference: b.paymentReference,
        note: 'Recorded payment',
      },
    ];
  }
  return [];
}

/**
 * Export Booking Tracker + Payment History report to Excel (2 sheets)
 */
export function exportReportToExcel(bookings: Booking[], filename: string = 'TAMIMA_Booking_Report') {
  const trackerRows = bookings.map((b) => ({
    'Date Booked': new Date(b.createdAt).toLocaleDateString(),
    'Check-In': b.checkInDate,
    'Check-Out': b.checkOutDate,
    'Ref': b.bookingRef,
    'Status': b.status,
    'Customer': b.customerName,
    'Phone': b.customerPhone,
    'Hotel': b.hotelName,
    'City': b.hotelCity,
    'Nights': b.totalNights,
    'Total Bill (SAR)': Math.round(b.totalSellSAR * 100) / 100,
    'Paid (SAR)': Math.round(b.amountPaidSAR * 100) / 100,
    'Balance (SAR)': Math.round((b.totalSellSAR - b.amountPaidSAR) * 100) / 100,
    'Total Bill (IDR)': Math.round(b.totalSellIDR),
    'Paid (IDR)': Math.round(b.amountPaidIDR),
    'Balance (IDR)': Math.round(b.totalSellIDR - b.amountPaidIDR),
    'Profit (SAR)': Math.round(b.profitSAR * 100) / 100,
    'Margin %': b.profitMarginPercent.toFixed(2),
    'Issuing Staff': b.staffName,
  }));

  const historyRows: Record<string, string | number>[] = [];
  bookings.forEach((b) => {
    resolvePaymentHistory(b).forEach((p, idx) => {
      historyRows.push({
        'Ref': b.bookingRef,
        'Customer': b.customerName,
        'Hotel': b.hotelName,
        'Payment #': idx + 1,
        'Payment Date': new Date(p.date).toLocaleDateString(),
        'Method': p.method,
        'Reference': p.reference || '-',
        'Amount (SAR)': Math.round(p.amountSAR * 100) / 100,
        'Amount (IDR)': Math.round(p.amountIDR),
        'Note': p.note || '-',
      });
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trackerRows), 'Booking Tracker');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(historyRows.length ? historyRows : [{ Info: 'No payment records in selection' }]),
    'Payment History'
  );
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export a pre-rendered landscape report sheet to a single-page A4 Landscape PDF
 */
export async function exportLandscapeReportPDF(elementId: string, filename: string): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) return false;

  try {
    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1400,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;

    // Fit the entire sheet into exactly one landscape page
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;

    pdf.addImage(imgData, 'PNG', x, y, w, h);
    pdf.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating landscape PDF:', err);
    return false;
  }
}

/**
 * Single-page A4 portrait PDF: the whole element is scaled to fit inside the
 * printable area (adaptive margins) so nothing is ever cut off.
 */
export interface PageLayoutOptions {
  marginMm?: number;
  scalePercent?: number;
}

async function waitForDocumentAssets(element: HTMLElement) {
  if ('fonts' in document) await document.fonts.ready;
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) {
        try {
          await image.decode();
        } catch {
          /* image is already complete; browser may not support decode */
        }
        return;
      }
      await new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });
    })
  );
}

export async function exportSinglePagePDF(
  elementId: string,
  filename: string,
  options: PageLayoutOptions = {}
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) return false;
  try {
    await waitForDocumentAssets(element);
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: Math.max(1200, element.scrollWidth),
      windowHeight: Math.max(1600, element.scrollHeight),
      onclone: (clonedDocument) => {
        const cloned = clonedDocument.getElementById(elementId);
        if (!cloned) return;
        cloned.style.transform = 'none';
        cloned.style.position = 'static';
        cloned.style.left = 'auto';
        cloned.style.top = 'auto';
        cloned.style.margin = '0';
        cloned.querySelectorAll<HTMLElement>('*').forEach((node) => {
          node.style.animation = 'none';
          node.style.transition = 'none';
          node.style.textShadow = 'none';
        });
      },
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const margin = Math.max(3, Math.min(18, options.marginMm ?? 6));
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const scaleFactor = Math.max(0.7, Math.min(1, (options.scalePercent ?? 100) / 100));
    const ratio = Math.min(availW / canvas.width, availH / canvas.height) * scaleFactor;
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
    pdf.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating single-page PDF:', err);
    return false;
  }
}

/** Print the same captured one-page document used by PDF export. */
export async function printSinglePageA4(
  elementId: string,
  options: PageLayoutOptions = {}
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) return false;
  const popup = window.open('', '_blank', 'width=900,height=1100');
  if (!popup) return false;
  popup.document.write('<p style="font-family:Arial;padding:20px">Preparing print preview…</p>');
  try {
    await waitForDocumentAssets(element);
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: Math.max(1200, element.scrollWidth),
      windowHeight: Math.max(1600, element.scrollHeight),
      onclone: (clonedDocument) => {
        const cloned = clonedDocument.getElementById(elementId);
        if (!cloned) return;
        cloned.style.transform = 'none';
        cloned.style.position = 'static';
        cloned.style.left = 'auto';
        cloned.style.top = 'auto';
        cloned.style.margin = '0';
        cloned.querySelectorAll<HTMLElement>('*').forEach((node) => {
          node.style.animation = 'none';
          node.style.transition = 'none';
          node.style.textShadow = 'none';
        });
      },
    });
    const margin = Math.max(3, Math.min(18, options.marginMm ?? 6));
    const scale = Math.max(70, Math.min(100, options.scalePercent ?? 100));
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><title>Print Confirmation Letter</title>
      <style>
        @page { size: A4 portrait; margin: ${margin}mm; }
        html,body{margin:0;padding:0;background:#fff;width:100%;height:100%;}
        body{display:flex;align-items:flex-start;justify-content:center;overflow:hidden;}
        img{display:block;width:${scale}%;max-width:100%;max-height:calc(297mm - ${margin * 2}mm);object-fit:contain;}
      </style></head><body><img src="${canvas.toDataURL('image/png')}" /></body></html>`);
    popup.document.close();
    const image = popup.document.querySelector('img');
    image?.addEventListener('load', () => {
      popup.focus();
      popup.print();
    });
    return true;
  } catch (error) {
    popup.close();
    console.error('Error preparing print preview:', error);
    return false;
  }
}

/**
 * Landscape A4 PDF that fills the page width and paginates vertically,
 * so all data sits inside the printable area with minimal blank space.
 */
export async function exportLandscapePagesPDF(elementId: string, filename: string): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) return false;
  try {
    const canvas = await html2canvas(element, { scale: 2.5, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297;
    const pageH = 210;
    const margin = 5;
    const w = pageW - margin * 2;
    const ratio = w / canvas.width;
    const pageContentH = pageH - margin * 2;
    const slicePx = Math.floor(pageContentH / ratio);

    let y = 0;
    let page = 0;
    while (y < canvas.height) {
      const sliceH = Math.min(canvas.height - y, slicePx);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, w, sliceH * ratio);
      y += sliceH;
      page++;
    }
    pdf.save(`${filename}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating landscape pages PDF:', err);
    return false;
  }
}

/** Resolve vendor payment records for a booking */
export function resolveVendorPayments(b: Booking): PaymentRecord[] {
  return b.vendorPayments || [];
}

/** Sum vendor-paid totals (SAR & IDR) using each record's transaction rate */
export function vendorPaidTotals(b: Booking) {
  return resolveVendorPayments(b).reduce(
    (acc, p) => {
      acc.sar += p.amountSAR;
      acc.idr += p.amountIDR;
      return acc;
    },
    { sar: 0, idr: 0 }
  );
}

/** Download a styled HTML table as .xls so Excel renders the PDF-matching template */
function downloadStyledXls(htmlBody: string, filename: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
  <x:Name>Report</x:Name>
  <x:WorksheetOptions><x:DisplayGridlines/><x:Print><x:PaperSizeIndex>9</x:PaperSizeIndex><x:Landscape/></x:Print></x:WorksheetOptions>
  </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>
    td, th { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; vertical-align: middle; }
    @page { size: A4 landscape; mso-page-orientation: landscape; }
  </style></head>
  <body>${htmlBody}</body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const S = {
  statusCell: (status: string) => {
    const map: Record<string, string> = {
      Paid: 'background:#d1fae5;color:#065f46;font-weight:bold',
      Partial: 'background:#fef3c7;color:#92400e;font-weight:bold',
      Unpaid: 'background:#fee2e2;color:#991b1b;font-weight:bold',
      Draft: 'background:#f1f5f9;color:#475569;font-weight:bold',
      Cancelled: 'background:#e5e7eb;color:#4b5569;font-weight:bold',
    };
    return map[status] || map.Draft;
  },
  th: 'background:#0f172a;color:#ffffff;font-weight:bold;font-size:9px;letter-spacing:0.5px;padding:5px 7px;border:1px solid #0f172a',
  td: 'padding:4px 7px;border:1px solid #e2e8f0',
  right: 'text-align:right',
};

/**
 * CUSTOMER REPORT (.xls) — styled to match the PDF template; no confidential data
 */
export function exportCustomerReportToExcel(bookings: Booking[], settings: CompanySettings, filename = 'TAMIMA_Customer_Report') {
  const totals = bookings.reduce(
    (a, b) => {
      a.sellSAR += b.totalSellSAR; a.sellIDR += b.totalSellIDR;
      a.paidSAR += b.amountPaidSAR; a.paidIDR += b.amountPaidIDR;
      a.balSAR += b.totalSellSAR - b.amountPaidSAR; a.balIDR += b.totalSellIDR - b.amountPaidIDR;
      return a;
    },
    { sellSAR: 0, sellIDR: 0, paidSAR: 0, paidIDR: 0, balSAR: 0, balIDR: 0 }
  );
  const legal = settings.legalEntityName || settings.companyName;
  const averageRate = averageTransactionRate(
    bookings.flatMap((booking) => booking.paymentHistory || []),
    settings.defaultExchangeRateSARtoIDR
  );

  const rows = bookings
    .map(
      (b, i) => {
        const bookingRate = averageTransactionRate(
          b.paymentHistory,
          b.exchangeRate || settings.defaultExchangeRateSARtoIDR
        );
        return `<tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'}">
      <td style="${S.td}">${i + 1}</td>
      <td style="${S.td};color:#ea580c;font-weight:bold">${b.bookingRef}</td>
      <td style="${S.td};font-weight:bold">${b.bookingType === 'Group' ? b.travelCompany || '-' : b.customerName}</td>
      <td style="${S.td}">${b.bookingType === 'Group' ? `c/o ${b.customerName}` : b.customerPassport || '-'}</td>
      <td style="${S.td}">${b.customerPhone}</td>
      <td style="${S.td}">${b.hotelName}</td>
      <td style="${S.td}">${b.checkInDate}</td>
      <td style="${S.td}">${b.checkOutDate}</td>
      <td style="${S.td};text-align:center">${b.totalNights}</td>
      <td style="${S.td};${S.right};font-weight:bold">${idNum(b.totalSellSAR)}</td>
      <td style="${S.td};${S.right};font-weight:bold">${idNum(bookingRate, 2)}</td>
      <td style="${S.td};${S.right};color:#047857;font-weight:bold">${idNum(b.amountPaidSAR)}</td>
      <td style="${S.td};text-align:center;font-weight:bold">${resolvePaymentHistory(b).length}</td>
      <td style="${S.td};${S.right};color:${b.totalSellSAR - b.amountPaidSAR > 0 ? '#dc2626' : '#94a3b8'};font-weight:bold">${idNum(b.totalSellSAR - b.amountPaidSAR)}</td>
      <td style="${S.td}">${b.dueDate || '-'}</td>
      <td style="${S.td};${S.statusCell(b.status)}">${b.status.toUpperCase()}</td>
    </tr>`;
      }
    )
    .join('');

  const html = `<table border="0" cellspacing="0" cellpadding="0" style="width:100%">
    <tr>
      <td colspan="10" style="font-size:16px;font-weight:900;color:#ea580c;padding:2px 0">${legal.toUpperCase()}</td>
      <td colspan="6" rowspan="2" style="background:#f97316;color:#fff;font-weight:900;font-size:14px;text-align:center;padding:8px">CUSTOMER REPORT<br/><span style="font-size:8px;font-weight:normal">A4 Landscape · Generated ${new Date().toLocaleString('en-GB')}</span></td>
    </tr>
    <tr><td colspan="10" style="font-size:9px;font-style:italic;color:#64748b">${settings.tagline} · ${settings.waPhone || settings.phone}</td></tr>
    <tr>
      <th style="${S.th}">NO</th><th style="${S.th}">REF</th><th style="${S.th}">CUSTOMER / COMPANY</th><th style="${S.th}">ID / CONTACT</th><th style="${S.th}">PHONE</th><th style="${S.th}">HOTEL</th><th style="${S.th}">CHECK-IN</th><th style="${S.th}">CHECK-OUT</th><th style="${S.th}">NIGHTS</th><th style="${S.th};${S.right}">TOTAL (SAR)</th><th style="${S.th};${S.right}">AVG RATE (IDR/SAR)</th><th style="${S.th};${S.right}">PAID (SAR)</th><th style="${S.th}">TERMIN</th><th style="${S.th};${S.right}">BALANCE (SAR)</th><th style="${S.th}">DUE</th><th style="${S.th}">STATUS</th>
    </tr>
    ${rows}
    <tr>
      <td colspan="9" style="background:#f97316;color:#fff;font-weight:900;padding:5px 7px">TOTAL — ${bookings.length} BOOKING(S)</td>
      <td style="background:#f97316;color:#fff;font-weight:900;${S.right};padding:5px 7px">${idNum(totals.sellSAR)}</td>
      <td style="background:#f97316;color:#fff;font-weight:900;${S.right};padding:5px 7px">${idNum(averageRate, 2)}</td>
      <td style="background:#f97316;color:#fff;font-weight:900;${S.right};padding:5px 7px">${idNum(totals.paidSAR)}</td>
      <td style="background:#f97316;color:#fff;padding:5px 7px"></td>
      <td style="background:#f97316;color:#fff;font-weight:900;${S.right};padding:5px 7px">${idNum(totals.balSAR)}</td>
      <td colspan="2" style="background:#f97316;color:#fff;padding:5px 7px"></td>
    </tr>
    <tr>
      <td colspan="9" style="background:#0f172a;color:#fff;font-weight:bold;font-size:9px;padding:4px 7px">AVERAGE EXCHANGE RATE — 1 SAR = ${idNum(averageRate, 2)} IDR</td>
      <td colspan="7" style="background:#0f172a;color:#fff;${S.right};font-family:monospace;padding:4px 7px">Total SAR ${idNum(totals.sellSAR)} · Paid SAR ${idNum(totals.paidSAR)} · Balance SAR ${idNum(totals.balSAR)}</td>
    </tr>
    <tr><td colspan="16" style="background:#fff7ed;color:#9a3412;font-size:8px;font-weight:bold;padding:4px 7px;border:1px solid #fdba74">CATATAN KURS: Balance customer dicantumkan dalam SAR. Average rate memakai weighted average seluruh history transaksi invoice dan menyesuaikan kurs yang berlaku saat transaksi dilakukan.</td></tr>
    <tr><td colspan="16" style="background:#0f172a;color:#fff;font-size:8px;font-weight:bold;letter-spacing:1px;text-align:center;padding:4px">${legal.toUpperCase()} · CUSTOMER BOOKING REPORT · ${bookings.length} RECORD(S)</td></tr>
  </table>`;

  downloadStyledXls(html, filename);
}

/**
 * FINANCE REPORT (.xls) — styled like the PDF; full confidential company data
 */
export function exportFinanceReportToExcel(bookings: Booking[], settings: CompanySettings, filename = 'TAMIMA_Finance_Report') {
  const t = bookings.reduce(
    (a, b) => {
      a.cost += b.totalCostSAR; a.sell += b.totalSellSAR; a.profit += b.profitSAR;
      a.paid += b.amountPaidSAR; a.bal += b.totalSellSAR - b.amountPaidSAR;
      a.vendor += vendorPaidTotals(b).sar; a.profitIDR += b.profitIDR;
      return a;
    },
    { cost: 0, sell: 0, profit: 0, paid: 0, bal: 0, vendor: 0, profitIDR: 0 }
  );
  const margin = t.sell > 0 ? (t.profit / t.sell) * 100 : 0;
  const legal = settings.legalEntityName || settings.companyName;

  const rows = bookings
    .map((b, i) => {
      const vp = vendorPaidTotals(b).sar;
      return `<tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'}">
      <td style="${S.td}">${i + 1}</td>
      <td style="${S.td}">${new Date(b.createdAt).toLocaleDateString('en-GB')}</td>
      <td style="${S.td};color:#ea580c;font-weight:bold">${b.bookingRef}</td>
      <td style="${S.td};font-weight:bold">${b.customerName}</td>
      <td style="${S.td}">${b.hotelName}</td>
      <td style="${S.td};text-align:center">${b.totalNights}</td>
      <td style="${S.td};${S.right};color:#64748b">${idNum(b.totalCostSAR)}</td>
      <td style="${S.td};${S.right};font-weight:bold">${idNum(b.totalSellSAR)}</td>
      <td style="${S.td};${S.right};color:#047857;font-weight:bold">${idNum(b.profitSAR)}</td>
      <td style="${S.td};text-align:center;font-weight:bold;color:${b.profitMarginPercent >= 15 ? '#047857' : b.profitMarginPercent >= 5 ? '#b45309' : '#b91c1c'}">${b.profitMarginPercent.toFixed(1)}%</td>
      <td style="${S.td};${S.right};color:#047857;font-weight:bold">${idNum(b.amountPaidSAR)} (${resolvePaymentHistory(b).length}x)</td>
      <td style="${S.td};${S.right};color:#be123c;font-weight:bold">${idNum(vp)} (${resolveVendorPayments(b).length}x)</td>
      <td style="${S.td};${S.right};color:${b.totalSellSAR - b.amountPaidSAR > 0 ? '#dc2626' : '#94a3b8'};font-weight:bold">${idNum(b.totalSellSAR - b.amountPaidSAR)}</td>
      <td style="${S.td};${S.right};color:#047857">${idNum(b.profitIDR)}</td>
      <td style="${S.td};font-size:8px">${b.paymentMethod}</td>
      <td style="${S.td}">${b.staffName}</td>
      <td style="${S.td};${S.statusCell(b.status)}">${b.status.toUpperCase()}</td>
    </tr>`;
    })
    .join('');

  const kpi = (label: string, value: string, bg: string, color: string) =>
    `<td style="background:${bg};color:${color};font-weight:900;padding:5px 8px;border:1px solid #e2e8f0"><span style="font-size:7px;font-weight:bold;letter-spacing:1px;color:#64748b">${label}</span><br/>${value}</td>`;

  const html = `<table border="0" cellspacing="0" cellpadding="0" style="width:100%">
    <tr>
      <td colspan="11" style="font-size:16px;font-weight:900;color:#ea580c;padding:2px 0">${legal.toUpperCase()}</td>
      <td colspan="6" rowspan="2" style="background:#0f172a;color:#fff;font-weight:900;font-size:14px;text-align:center;padding:8px">FINANCE REPORT<br/><span style="font-size:8px;color:#fca5a5;border:1px solid #dc2626;padding:0 4px">CONFIDENTIAL — INTERNAL USE ONLY</span></td>
    </tr>
    <tr><td colspan="11" style="font-size:9px;font-style:italic;color:#64748b">${settings.tagline} · Generated ${new Date().toLocaleString('en-GB')}</td></tr>
    <tr>
      ${kpi('BOOKINGS', String(bookings.length), '#f1f5f9', '#0f172a')}
      ${kpi('SUPPLIER COST', `SAR ${idNum(t.cost)}`, '#f8fafc', '#475569')}
      ${kpi('REVENUE', `SAR ${idNum(t.sell)}`, '#fff7ed', '#0f172a')}
      ${kpi('NET PROFIT', `SAR ${idNum(t.profit)}`, '#ecfdf5', '#047857')}
      ${kpi('AVG MARGIN', `${margin.toFixed(1)}%`, '#fff7ed', '#ea580c')}
      ${kpi('VENDOR PAID', `SAR ${idNum(t.vendor)}`, '#fef2f2', '#be123c')}
      ${kpi('COLLECTED', `SAR ${idNum(t.paid)}`, '#ecfdf5', '#047857')}
      ${kpi('OUTSTANDING', `SAR ${idNum(t.bal)}`, '#fef2f2', '#dc2626')}
      <td colspan="9" style="background:#0f172a;color:#fff;font-size:8px;font-weight:bold;text-align:center;letter-spacing:1px">REALIZED CASH POSITION: SAR ${idNum(t.paid - t.vendor)}</td>
    </tr>
    <tr>
      <th style="${S.th}">NO</th><th style="${S.th}">DATE</th><th style="${S.th}">REF</th><th style="${S.th}">CUSTOMER</th><th style="${S.th}">HOTEL</th><th style="${S.th}">NIGHTS</th><th style="${S.th};${S.right}">COST (SAR)</th><th style="${S.th};${S.right}">SELL (SAR)</th><th style="${S.th};${S.right}">PROFIT (SAR)</th><th style="${S.th}">MARGIN</th><th style="${S.th};${S.right}">CUSTOMER PAID</th><th style="${S.th};${S.right}">VENDOR PAID</th><th style="${S.th};${S.right}">BALANCE</th><th style="${S.th};${S.right}">PROFIT (IDR)</th><th style="${S.th}">METHOD</th><th style="${S.th}">STAFF</th><th style="${S.th}">STATUS</th>
    </tr>
    ${rows}
    <tr>
      <td colspan="6" style="background:#f97316;color:#fff;font-weight:900;padding:5px 7px">TOTAL — ${bookings.length} BOOKING(S)</td>
      <td style="background:#f97316;color:#fff;${S.right};font-weight:900;padding:5px 7px">${idNum(t.cost)}</td>
      <td style="background:#f97316;color:#fff;${S.right};font-weight:900;padding:5px 7px">${idNum(t.sell)}</td>
      <td style="background:#f97316;color:#fff;${S.right};font-weight:900;padding:5px 7px">${idNum(t.profit)}</td>
      <td style="background:#f97316;color:#fff;text-align:center;font-weight:900;padding:5px 7px">${margin.toFixed(1)}%</td>
      <td style="background:#f97316;color:#fff;${S.right};font-weight:900;padding:5px 7px">${idNum(t.paid)}</td>
      <td style="background:#f97316;color:#fff;${S.right};font-weight:900;padding:5px 7px">${idNum(t.vendor)}</td>
      <td style="background:#f97316;color:#fff;${S.right};font-weight:900;padding:5px 7px">${idNum(t.bal)}</td>
      <td style="background:#f97316;color:#fff;${S.right};font-weight:900;padding:5px 7px">${idNum(t.profitIDR)}</td>
      <td colspan="3" style="background:#f97316;color:#fff;padding:5px 7px"></td>
    </tr>
    <tr><td colspan="17" style="background:#0f172a;color:#fff;font-size:8px;font-weight:bold;letter-spacing:1px;text-align:center;padding:4px">${legal.toUpperCase()} · INTERNAL FINANCE REPORT · ${bookings.length} RECORD(S)</td></tr>
  </table>`;

  downloadStyledXls(html, filename);
}

/**
 * STATEMENT BOOKING AGENT (.xls) — internal finance statement matching the
 * reference layout: KPI band, booking info, BUY/SELL room matrix, payment
 * columns with per-transaction rate, accumulated summary & confidential notes.
 */
export function exportStatementBookingAgent(
  bookings: Booking[],
  settings: CompanySettings,
  filename = 'TAMIMA_Statement_Booking_Agent'
) {
  const legal = settings.legalEntityName || settings.companyName;
  const ROOM_LABELS = ['Double', 'Triple', 'Quad', 'Quint', 'Bed', 'Extra', 'Unit'];
  const ROOM_CODES = ['DBL', 'TRP', 'QRD', 'QNT', 'BED', 'EXT', 'UNIT'];
  const NAVY = 'background:#1f3864;color:#fff;font-size:8px;font-weight:bold;text-align:center;padding:3px 4px;border:1px solid #16294a';
  const CELL = 'font-size:8.5px;padding:3px 5px;border:1px solid #cbd5e1';
  const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  const blocks = bookings
    .map((b) => {
      const rate = b.exchangeRate || settings.defaultExchangeRateSARtoIDR;
      const roomOf = (label: string) => b.rooms.find((r) => r.roomType === label);
      const custPay = b.paymentHistory || [];
      const vendPay = b.vendorPayments || [];
      const vendorPaidIDR = vendPay.reduce((s, p) => s + p.amountIDR, 0);
      const vendorPaidSAR = Math.round(vendorPaidIDR / (rate || 1));
      const paidSAR = Math.round(b.amountPaidIDR / (rate || 1));
      const month = new Date(`${b.checkInDate}T00:00:00`)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        .toUpperCase();
      const agent = b.bookingType === 'Group' ? b.travelCompany || b.customerName : b.customerName;
      const transCost = b.additionalServices.reduce((s, x) => s + x.cost, 0);
      const transSell = b.additionalServices.reduce((s, x) => s + x.sell, 0);
      const np = b.totalSellIDR - b.totalCostIDR;
      const marginPct = b.totalSellIDR > 0 ? ((np / b.totalSellIDR) * 100).toFixed(2) : '0.00';

      const roomCells = (side: 'buy' | 'sell') =>
        ROOM_LABELS.map((label) => {
          const r = roomOf(label);
          const q = r ? r.numberOfRooms : 0;
          const rt = r ? (side === 'buy' ? r.costPerNight : r.sellPerNight) : 0;
          const bg = side === 'buy' ? '#fdeaea' : '#eaf7ee';
          return `<td style="${CELL};text-align:center;background:${bg}">${q}</td><td style="${CELL};text-align:center;background:${bg}">${q ? idNum(rt) : 0}</td>`;
        }).join('');

      const payCells = (list: PaymentRecord[]) =>
        Array.from({ length: 5 }, (_, i) => {
          const p = list[i];
          return `<td style="${CELL};text-align:right">${p ? idNum(p.amountIDR) : 0}</td><td style="${CELL};text-align:center">${p && p.exchangeRate ? idNum(p.exchangeRate) : 0}</td>`;
        }).join('');

      return `<table border="0" cellspacing="0" cellpadding="0" style="width:100%;margin-bottom:28px">
      <tr><td colspan="38" style="text-align:center;font-size:15px;font-weight:900;padding:4px">STATEMENT BOOKING AGENT</td></tr>
      <tr><td colspan="38" style="text-align:center;font-size:10px">${legal} oleh ${agent}</td></tr>
      <tr><td colspan="38" style="text-align:center;font-size:9px;color:#1d4ed8">BULAN ${month}</td></tr>
      <tr><td colspan="38" style="text-align:center;font-size:9px;color:#dc2626;font-weight:bold;border-top:2px solid #f97316;border-bottom:2px solid #f97316;padding:3px">&#128274; LAPORAN INTERNAL &mdash; RAHASIA PERUSAHAAN</td></tr>
      <tr><td colspan="38" style="height:8px"></td></tr>
      <tr>
        <td colspan="10" style="background:#fdeaea;border:2px solid #dc2626;text-align:center;padding:5px;font-size:9px;font-weight:bold;color:#b91c1c">MODAL VENDOR (BUY)<br/><span style="font-size:12px;font-weight:900">IDR ${idNum(b.totalCostIDR)}</span></td>
        <td colspan="9" style="background:#eaf7ee;border:2px solid #16a34a;text-align:center;padding:5px;font-size:9px;font-weight:bold;color:#15803d">HARGA JUAL (SELL)<br/><span style="font-size:12px;font-weight:900">IDR ${idNum(b.totalSellIDR)}</span></td>
        <td colspan="9" style="background:#fdf6d8;border:2px solid #ca8a04;text-align:center;padding:5px;font-size:9px;font-weight:bold;color:#a16207">NET PROFIT<br/><span style="font-size:12px;font-weight:900">IDR ${idNum(np)}</span></td>
        <td colspan="10" style="background:#e8eefb;border:2px solid #2563eb;text-align:center;padding:5px;font-size:9px;font-weight:bold;color:#1d4ed8">MARGIN %<br/><span style="font-size:12px;font-weight:900">${marginPct}%</span></td>
      </tr>
      <tr><td colspan="38" style="height:6px"></td></tr>
      <tr><td colspan="38" style="background:#eef1f5;font-size:9px;font-weight:bold;padding:3px 5px;border:1px solid #cbd5e1">&#128204; INFORMASI BOOKING &mdash; ${b.bookingRef}</td></tr>
      <tr>
        <td colspan="4" style="${CELL};font-weight:bold">Hotel:</td><td colspan="6" style="${CELL}">${b.hotelName}</td>
        <td colspan="4" style="${CELL};font-weight:bold">Customer:</td><td colspan="8" style="${CELL}">${agent}</td>
        <td colspan="4" style="${CELL};font-weight:bold">Status:</td><td colspan="6" style="${CELL};font-weight:bold;color:${b.status === 'Paid' ? '#15803d' : '#b91c1c'}">${b.status === 'Paid' ? 'LUNAS' : b.status === 'Partial' ? 'PARTIAL' : 'BELUM LUNAS'}</td>
        <td colspan="3" style="${CELL};font-weight:bold">Sales:</td><td colspan="3" style="${CELL}">${b.staffName}</td>
      </tr>
      <tr>
        <td colspan="4" style="${CELL};font-weight:bold">Vendor:</td><td colspan="6" style="${CELL};background:#fdf6d8">${b.vendorName || '-'}</td>
        <td colspan="4" style="${CELL};font-weight:bold">PIC Internal:</td><td colspan="8" style="${CELL};background:#fdf6d8">${b.vendorPic || b.staffName}</td>
        <td colspan="4" style="${CELL};font-weight:bold">Periode:</td><td colspan="12" style="${CELL}">${fmtDate(b.checkInDate)} &rarr; ${fmtDate(b.checkOutDate)} (${b.totalNights} Malam)</td>
      </tr>
      <tr><td colspan="38" style="height:6px"></td></tr>
      <tr>
        <td rowspan="2" style="${NAVY}">#</td>
        <td colspan="2" style="${NAVY}">Tanggal</td>
        <td rowspan="2" style="${NAVY}">Total<br/>Night</td>
        <td colspan="14" style="${NAVY}">Room Type &amp; Rate (SAR)</td>
        <td rowspan="2" style="${NAVY}">Meal</td><td rowspan="2" style="${NAVY}">VAT</td><td rowspan="2" style="${NAVY}">Trans</td>
        <td rowspan="2" style="${NAVY}">Total<br/>Tagihan SAR</td>
        <td colspan="10" style="${NAVY}">Pembayaran 1 &ndash; 5 (IDR / Kurs)</td>
        <td colspan="6" style="${NAVY}">Summary Akumulasi</td>
      </tr>
      <tr>
        <td style="${NAVY}">Check In</td><td style="${NAVY}">Check Out</td>
        ${ROOM_CODES.map((c) => `<td style="${NAVY}">${c} Q</td><td style="${NAVY}">${c} R</td>`).join('')}
        ${Array.from({ length: 5 }, () => `<td style="${NAVY}">IDR</td><td style="${NAVY}">Kurs</td>`).join('')}
        <td style="${NAVY}">Total IDR<br/>Masuk</td><td style="${NAVY}">Total SAR<br/>Masuk</td><td style="${NAVY}">Sisa SAR</td><td style="${NAVY}">Est. Kurs</td><td style="${NAVY}">Sisa IDR</td><td style="${NAVY}">Total IDR<br/>Aktual</td>
      </tr>
      <tr>
        <td style="${CELL};font-weight:900;background:#fdeaea">BUY</td>
        <td style="${CELL};background:#fdeaea">${fmtDate(b.checkInDate)}</td><td style="${CELL};background:#fdeaea">${fmtDate(b.checkOutDate)}</td>
        <td style="${CELL};text-align:center;background:#fdeaea">${b.totalNights}</td>
        ${roomCells('buy')}
        <td style="${CELL};text-align:center;background:#fdeaea">${b.rooms[0]?.mealPlan || '-'}</td>
        <td style="${CELL};text-align:center;background:#fdeaea">-</td>
        <td style="${CELL};text-align:center;background:#fdeaea">${idNum(transCost)}</td>
        <td style="${CELL};text-align:right;font-weight:bold;background:#fdeaea">SAR ${idNum(b.totalCostSAR)}</td>
        ${payCells(vendPay)}
        <td style="${CELL};text-align:right;font-weight:bold;background:#fdeaea">${idNum(vendorPaidIDR)}</td>
        <td style="${CELL};text-align:right;background:#fdeaea">${idNum(vendorPaidSAR)}</td>
        <td style="${CELL};text-align:right;background:#fdeaea">${idNum(b.totalCostSAR - vendorPaidSAR)}</td>
        <td style="${CELL};text-align:center;background:#fdeaea">${idNum(rate)}</td>
        <td style="${CELL};text-align:right;background:#fdeaea">${idNum(b.totalCostIDR - vendorPaidIDR)}</td>
        <td style="${CELL};text-align:right;font-weight:900;background:#fdeaea">${idNum(b.totalCostIDR)}</td>
      </tr>
      <tr>
        <td style="${CELL};font-weight:900;background:#eaf7ee">SELL</td>
        <td style="${CELL};background:#eaf7ee">${fmtDate(b.checkInDate)}</td><td style="${CELL};background:#eaf7ee">${fmtDate(b.checkOutDate)}</td>
        <td style="${CELL};text-align:center;background:#eaf7ee">${b.totalNights}</td>
        ${roomCells('sell')}
        <td style="${CELL};text-align:center;background:#eaf7ee">${b.rooms[0]?.mealPlan || '-'}</td>
        <td style="${CELL};text-align:center;background:#eaf7ee">-</td>
        <td style="${CELL};text-align:center;background:#eaf7ee">${idNum(transSell)}</td>
        <td style="${CELL};text-align:right;font-weight:bold;background:#eaf7ee">SAR ${idNum(b.totalSellSAR)}</td>
        ${payCells(custPay)}
        <td style="${CELL};text-align:right;font-weight:bold;background:#eaf7ee">${idNum(b.amountPaidIDR)}</td>
        <td style="${CELL};text-align:right;background:#eaf7ee">${idNum(paidSAR)}</td>
        <td style="${CELL};text-align:right;background:#eaf7ee;color:${b.totalSellSAR - paidSAR < 0 ? '#15803d' : '#b91c1c'}">${b.totalSellSAR - paidSAR < 0 ? `DEP ${idNum(Math.abs(b.totalSellSAR - paidSAR))}` : idNum(b.totalSellSAR - paidSAR)}</td>
        <td style="${CELL};text-align:center;background:#eaf7ee">${idNum(rate)}</td>
        <td style="${CELL};text-align:right;background:#eaf7ee">${idNum(Math.abs(b.totalSellIDR - b.amountPaidIDR))}</td>
        <td style="${CELL};text-align:right;font-weight:900;background:#eaf7ee">${idNum(b.totalSellIDR)}</td>
      </tr>
      <tr><td colspan="38" style="height:6px"></td></tr>
      <tr>
        <td colspan="38" style="background:#e8ecfb;border:2px solid #2563eb;padding:6px 10px;text-align:right;font-size:8.5px;color:#1e3a8a">
          <b>&#128274; KETERANGAN INTERNAL (RAHASIA):</b><br/>
          &bull; Vendor: ${b.vendorName || '-'} &nbsp; &bull; PIC Internal: ${b.vendorPic || b.staffName}<br/>
          &bull; <b>Modal Vendor:</b> IDR ${idNum(b.totalCostIDR)} &nbsp;|&nbsp; <b>Net Profit:</b> IDR ${idNum(np)} (${marginPct}%)<br/>
          &bull; Dokumen ini berisi data finansial perusahaan dan TIDAK BOLEH disebarkan ke customer.
        </td>
      </tr>
      <tr><td colspan="38" style="height:6px"></td></tr>
      <tr>
        <td colspan="20" style="${CELL};font-style:italic;font-size:8px">Dicetak otomatis pada ${new Date().toLocaleString('id-ID')}</td>
        <td colspan="18" style="${CELL};text-align:center;font-size:8px">Tertanda,<br/><br/><b>( ${(settings.bookingManagerName || b.staffName || 'GHOFAR').toUpperCase()} )</b></td>
      </tr>
    </table>`;
    })
    .join('');

  downloadStyledXls(blocks, filename);
}

/**
 * STATEMENT BOOKING CUSTOMER (.xls) — customer-facing statement mirroring the
 * agent layout but containing ONLY customer data: sell rates, payments and
 * balances. No vendor, cost, profit or internal notes are ever included.
 */
export function exportStatementBookingCustomer(
  bookings: Booking[],
  settings: CompanySettings,
  filename = 'TAMIMA_Statement_Booking_Customer'
) {
  const legal = settings.legalEntityName || settings.companyName;
  const ROOM_LABELS = ['Double', 'Triple', 'Quad', 'Quint', 'Bed', 'Extra', 'Unit'];
  const ROOM_CODES = ['DBL', 'TRP', 'QRD', 'QNT', 'BED', 'EXT', 'UNIT'];
  const NAVY = 'background:#1f3864;color:#fff;font-size:8px;font-weight:bold;text-align:center;padding:3px 4px;border:1px solid #16294a';
  const CELL = 'font-size:8.5px;padding:3px 5px;border:1px solid #cbd5e1';
  const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  const blocks = bookings
    .map((b) => {
      const rate = averageTransactionRate(
        b.paymentHistory,
        b.exchangeRate || settings.defaultExchangeRateSARtoIDR
      );
      const roomOf = (label: string) => b.rooms.find((r) => r.roomType === label);
      const custPay = b.paymentHistory || [];
      const paidSAR = Math.round(b.amountPaidIDR / (rate || 1));
      const balSAR = b.totalSellSAR - paidSAR;
      const overpaid = balSAR < 0;
      const month = new Date(`${b.checkInDate}T00:00:00`)
        .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        .toUpperCase();
      const agent = b.bookingType === 'Group' ? b.travelCompany || b.customerName : b.customerName;
      const transSell = b.additionalServices.reduce((s, x) => s + x.sell, 0);

      const roomCells = ROOM_LABELS.map((label) => {
        const r = roomOf(label);
        const q = r ? r.numberOfRooms : 0;
        const rt = r ? r.sellPerNight : 0;
        return `<td style="${CELL};text-align:center;background:#eaf7ee">${q}</td><td style="${CELL};text-align:center;background:#eaf7ee">${q ? idNum(rt) : 0}</td>`;
      }).join('');

      const payCells = Array.from({ length: 5 }, (_, i) => {
        const p = custPay[i];
        return `<td style="${CELL};text-align:right">${p ? idNum(p.amountIDR) : 0}</td><td style="${CELL};text-align:center">${p && p.exchangeRate ? idNum(p.exchangeRate) : 0}</td>`;
      }).join('');

      return `<table border="0" cellspacing="0" cellpadding="0" style="width:100%;margin-bottom:28px">
      <tr><td colspan="38" style="text-align:center;font-size:15px;font-weight:900;padding:4px">STATEMENT BOOKING CUSTOMER</td></tr>
      <tr><td colspan="38" style="text-align:center;font-size:10px">${legal} &mdash; untuk ${agent}</td></tr>
      <tr><td colspan="38" style="text-align:center;font-size:9px;color:#1d4ed8">BULAN ${month}</td></tr>
      <tr><td colspan="38" style="text-align:center;font-size:9px;color:#047857;font-weight:bold;border-top:2px solid #10b981;border-bottom:2px solid #10b981;padding:3px">&#9989; DOKUMEN CUSTOMER &mdash; RINGKASAN BOOKING &amp; PEMBAYARAN</td></tr>
      <tr><td colspan="38" style="height:8px"></td></tr>
      <tr>
        <td colspan="13" style="background:#eaf7ee;border:2px solid #16a34a;text-align:center;padding:5px;font-size:9px;font-weight:bold;color:#15803d">TOTAL TAGIHAN<br/><span style="font-size:12px;font-weight:900">SAR ${idNum(b.totalSellSAR)}</span><br/><span style="font-size:7px">Average rate: 1 SAR = ${idNum(rate, 2)} IDR</span></td>
        <td colspan="12" style="background:#e8eefb;border:2px solid #2563eb;text-align:center;padding:5px;font-size:9px;font-weight:bold;color:#1d4ed8">TOTAL DITERIMA<br/><span style="font-size:12px;font-weight:900">SAR ${idNum(paidSAR)} &nbsp;/&nbsp; IDR ${idNum(b.amountPaidIDR)}</span></td>
        <td colspan="13" style="background:${overpaid ? '#eaf7ee' : '#fdeaea'};border:2px solid ${overpaid ? '#16a34a' : '#dc2626'};text-align:center;padding:5px;font-size:9px;font-weight:bold;color:${overpaid ? '#15803d' : '#b91c1c'}">${overpaid ? 'BALANCE DEPOSIT (KELEBIHAN BAYAR)' : 'SISA TAGIHAN'}<br/><span style="font-size:12px;font-weight:900">SAR ${idNum(Math.abs(balSAR))}</span><br/><span style="font-size:7px">Balance dicatat dalam SAR</span></td>
      </tr>
      <tr><td colspan="38" style="height:6px"></td></tr>
      <tr><td colspan="38" style="background:#eef1f5;font-size:9px;font-weight:bold;padding:3px 5px;border:1px solid #cbd5e1">&#128204; INFORMASI BOOKING &mdash; ${b.bookingRef}</td></tr>
      <tr>
        <td colspan="4" style="${CELL};font-weight:bold">Hotel:</td><td colspan="8" style="${CELL}">${b.hotelName} (${b.hotelCity})</td>
        <td colspan="4" style="${CELL};font-weight:bold">Customer:</td><td colspan="8" style="${CELL}">${agent}${b.bookingType === 'Group' ? ` (c/o ${b.customerName})` : ''}</td>
        <td colspan="4" style="${CELL};font-weight:bold">Status:</td><td colspan="5" style="${CELL};font-weight:bold;color:${b.status === 'Paid' ? '#15803d' : '#b91c1c'}">${b.status === 'Paid' ? 'LUNAS' : b.status === 'Partial' ? 'PARTIAL' : 'BELUM LUNAS'}</td>
        <td colspan="2" style="${CELL};font-weight:bold">Sales:</td><td colspan="3" style="${CELL}">${b.staffName}</td>
      </tr>
      <tr>
        <td colspan="4" style="${CELL};font-weight:bold">Periode:</td><td colspan="12" style="${CELL}">${fmtDate(b.checkInDate)} &rarr; ${fmtDate(b.checkOutDate)} (${b.totalNights} Malam)</td>
        <td colspan="4" style="${CELL};font-weight:bold">HCN/RSVP:</td><td colspan="6" style="${CELL};font-family:monospace;font-weight:bold">${b.hcnRsvp || '-'}</td>
        <td colspan="12" style="${CELL}"></td>
      </tr>
      <tr><td colspan="38" style="height:6px"></td></tr>
      <tr>
        <td rowspan="2" style="${NAVY}">#</td>
        <td colspan="2" style="${NAVY}">Tanggal</td>
        <td rowspan="2" style="${NAVY}">Total<br/>Night</td>
        <td colspan="14" style="${NAVY}">Room Type &amp; Rate (SAR)</td>
        <td rowspan="2" style="${NAVY}">Meal</td><td rowspan="2" style="${NAVY}">VAT</td><td rowspan="2" style="${NAVY}">Trans</td>
        <td rowspan="2" style="${NAVY}">Total<br/>Tagihan SAR</td>
        <td colspan="10" style="${NAVY}">Pembayaran 1 &ndash; 5 (IDR / Kurs)</td>
        <td colspan="6" style="${NAVY}">Summary Akumulasi</td>
      </tr>
      <tr>
        <td style="${NAVY}">Check In</td><td style="${NAVY}">Check Out</td>
        ${ROOM_CODES.map((c) => `<td style="${NAVY}">${c} Q</td><td style="${NAVY}">${c} R</td>`).join('')}
        ${Array.from({ length: 5 }, () => `<td style="${NAVY}">IDR</td><td style="${NAVY}">Kurs</td>`).join('')}
        <td style="${NAVY}">Total IDR<br/>Masuk</td><td style="${NAVY}">Total SAR<br/>Masuk</td><td style="${NAVY}">Sisa SAR</td><td style="${NAVY}">Avg. Kurs</td><td style="${NAVY}">Balance<br/>SAR</td><td style="${NAVY}">Rate<br/>SAR/IDR</td>
      </tr>
      <tr>
        <td style="${CELL};font-weight:900;background:#eaf7ee">SELL</td>
        <td style="${CELL};background:#eaf7ee">${fmtDate(b.checkInDate)}</td><td style="${CELL};background:#eaf7ee">${fmtDate(b.checkOutDate)}</td>
        <td style="${CELL};text-align:center;background:#eaf7ee">${b.totalNights}</td>
        ${roomCells}
        <td style="${CELL};text-align:center;background:#eaf7ee">${b.rooms[0]?.mealPlan || '-'}</td>
        <td style="${CELL};text-align:center;background:#eaf7ee">-</td>
        <td style="${CELL};text-align:center;background:#eaf7ee">${idNum(transSell)}</td>
        <td style="${CELL};text-align:right;font-weight:bold;background:#eaf7ee">SAR ${idNum(b.totalSellSAR)}</td>
        ${payCells}
        <td style="${CELL};text-align:right;font-weight:bold;background:#eaf7ee">${idNum(b.amountPaidIDR)}</td>
        <td style="${CELL};text-align:right;background:#eaf7ee">${idNum(paidSAR)}</td>
        <td style="${CELL};text-align:right;background:#eaf7ee;color:${overpaid ? '#15803d' : '#b91c1c'}">${overpaid ? `DEP ${idNum(Math.abs(balSAR))}` : idNum(balSAR)}</td>
        <td style="${CELL};text-align:center;background:#eaf7ee">${idNum(rate)}</td>
        <td style="${CELL};text-align:right;background:#eaf7ee">${overpaid ? `DEP ${idNum(Math.abs(balSAR))}` : idNum(balSAR)}</td>
        <td style="${CELL};text-align:right;font-weight:900;background:#eaf7ee">1 SAR = ${idNum(rate, 2)} IDR</td>
      </tr>
      <tr><td colspan="38" style="height:6px"></td></tr>
      <tr>
        <td colspan="38" style="background:#f0fdf4;border:2px solid #16a34a;padding:6px 10px;font-size:8.5px;color:#14532d">
          <b>&#128179; PEMBAYARAN:</b> Bank Mandiri a/n <b>${settings.bankDetails.mandiriAccountName || legal}</b> &mdash; No. Rek <b>${settings.bankDetails.mandiriAccountNumber || '-'}</b>
          &nbsp;|&nbsp; ${settings.bankDetails.saudiBank} &mdash; IBAN <b>${settings.bankDetails.saudiIban}</b><br/>
          Terima kasih telah mempercayakan perjalanan Anda kepada ${legal}. Dokumen ini hanya berisi ringkasan booking &amp; pembayaran Anda.<br/>
          <b>CATATAN KURS:</b> Balance customer dicantumkan dalam SAR. Average exchange rate berasal dari seluruh history transaksi invoice dan menyesuaikan kurs yang berlaku saat transaksi dilakukan.
        </td>
      </tr>
      <tr><td colspan="38" style="height:6px"></td></tr>
      <tr>
        <td colspan="20" style="${CELL};font-style:italic;font-size:8px">Dicetak otomatis pada ${new Date().toLocaleString('id-ID')}</td>
        <td colspan="18" style="${CELL};text-align:center;font-size:8px">Hormat kami,<br/><br/><b>${legal}</b><br/>${(settings.bookingManagerName || 'GHOFAR').toUpperCase()} &mdash; ${settings.bookingManagerRole || 'Booking Manager'}</td>
      </tr>
    </table>`;
    })
    .join('');

  downloadStyledXls(blocks, filename);
}

/* Legacy SheetJS-based report exports were replaced by the styled .xls template exports above. */

/**
 * Construct WhatsApp formatted message text
 */
export function getWhatsAppMessage(booking: Booking, settings: CompanySettings): string {
  const balanceSAR = booking.totalSellSAR - booking.amountPaidSAR;
  const balanceIDR = booking.totalSellIDR - booking.amountPaidIDR;

  return `*${settings.legalEntityName || settings.companyName}*
*CONFIRMATION LETTER - HOTEL BOOKING*

*Invoice Ref:* ${booking.bookingRef}
${booking.bookingType === 'Group' ? `*Travel Company:* ${booking.travelCompany || '-'}\n*Lead Contact:* ${booking.customerName}` : `*Guest:* ${booking.customerName} (Private)`}
*Hotel:* ${booking.hotelName} (${booking.hotelCity})
*Check-In:* ${booking.checkInDate}
*Check-Out:* ${booking.checkOutDate} (${booking.totalNights} Nights)

----------------------------------
*TOTAL:* ${formatSAR(booking.totalSellSAR)} / ${formatIDR(booking.totalSellIDR)}
*PAID:* ${formatSAR(booking.amountPaidSAR)} / ${formatIDR(booking.amountPaidIDR)}
*BALANCE:* ${formatSAR(balanceSAR)} / ${formatIDR(balanceIDR)}
*STATUS:* *${booking.status.toUpperCase()}*
----------------------------------

*Bank Mandiri* a/n ${settings.bankDetails.mandiriAccountName || settings.companyName}
No. Rek: ${settings.bankDetails.mandiriAccountNumber || settings.bankDetails.indonesiaAccount}

Thank you for trusting us!
WA: ${settings.waPhone || settings.phone}`;
}

/**
 * Share via WhatsApp URL trigger
 */
export function shareViaWhatsApp(booking: Booking, settings: CompanySettings) {
  const text = getWhatsAppMessage(booking, settings);
  const cleanPhone = booking.customerPhone.replace(/[^0-9]/g, '');
  const url = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/**
 * Share via Email mailto link
 */
export function shareViaEmail(booking: Booking, settings: CompanySettings) {
  const subject = `[Confirmation Letter] ${booking.bookingRef} - ${booking.customerName}`;
  const body = getWhatsAppMessage(booking, settings);
  const mailtoUrl = `mailto:${booking.customerEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoUrl;
}
