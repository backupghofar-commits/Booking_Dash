import * as XLSX from 'xlsx';
import type { CompanySettings } from '../types/booking';
import type { TrainBooking } from '../types/train';
import { TRAIN_STATIONS } from '../types/train';
import { bookingDisplayRoute } from './trainFinance';
import { formatIDR, formatSAR } from './currency';

export { exportSinglePagePDF } from './export';

const st = (code: string) => TRAIN_STATIONS.find((s) => s.code === code)?.shortName ?? code;

export function getTrainWhatsAppMessage(b: TrainBooking, settings: CompanySettings): string {
  const balSAR = b.totalSellSAR - b.amountPaidSAR;
  const balIDR = b.totalSellIDR - b.amountPaidIDR;
  const legs = b.legs.map((l) => `• ${l.direction}: ${l.trainNo || 'TBA'} · ${l.departureDate} ${l.departureTime}`).join('\n');
  return `*${settings.legalEntityName || settings.companyName}*\n*HARAMAIN TRAIN TICKET PASS*\n\n*Ref:* ${b.trainRef}\n*Customer:* ${b.travelCompany || b.customerName}\n*Route:* ${bookingDisplayRoute(b)} (${b.trainClass})\n${legs}\n*Pax:* ${b.paxCount}\n\n*TOTAL:* ${formatSAR(b.totalSellSAR)} / ${formatIDR(b.totalSellIDR)}\n*PAID:* ${formatSAR(b.amountPaidSAR)} / ${formatIDR(b.amountPaidIDR)}\n*BALANCE:* ${formatSAR(balSAR)} / ${formatIDR(balIDR)}\n*STATUS:* *${b.status.toUpperCase()}*\n\nArrive 60 min early with original ID.`;
}

export function shareTrainViaWhatsApp(b: TrainBooking, settings: CompanySettings) {
  const clean = b.customerPhone.replace(/[^0-9]/g, '');
  const url = clean
    ? `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(getTrainWhatsAppMessage(b, settings))}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(getTrainWhatsAppMessage(b, settings))}`;
  window.open(url, '_blank');
}

export function shareTrainViaEmail(b: TrainBooking, settings: CompanySettings) {
  const subject = `[Haramain Ticket] ${b.trainRef} - ${b.customerName}`;
  window.location.href = `mailto:${b.customerEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(getTrainWhatsAppMessage(b, settings))}`;
}

export function exportTrainToExcel(bookings: TrainBooking[], filename = 'TAMIMA_Haramain_Report') {
  const rows = bookings.map((b) => ({
    'Train Ref': b.trainRef,
    Status: b.status,
    Customer: b.travelCompany || b.customerName,
    Phone: b.customerPhone,
    Route: `${st(b.originCode)} → ${st(b.destinationCode)}`,
    Trip: b.tripType,
    Class: b.trainClass,
    'Train No': b.legs.map((l) => l.trainNo || 'TBA').join(' / '),
    Departure: `${b.legs[0]?.departureDate || ''} ${b.legs[0]?.departureTime || ''}`,
    Pax: b.paxCount,
    'Cost/pax (SAR)': b.costPerPax,
    'Sell/pax (SAR)': b.sellPerPax,
    'Cost (SAR)': b.totalCostSAR,
    'Sell (SAR)': b.totalSellSAR,
    'Profit (SAR)': b.profitSAR,
    'Margin %': b.profitMarginPercent.toFixed(2),
    'Paid (SAR)': b.amountPaidSAR,
    'Balance (SAR)': Math.round((b.totalSellSAR - b.amountPaidSAR) * 100) / 100,
    'Paid (IDR)': b.amountPaidIDR,
    Vendor: b.vendorName || '',
    Staff: b.staffName,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [16, 10, 24, 16, 22, 10, 10, 18, 20, 6, 12, 12, 12, 12, 12, 9, 12, 13, 14, 18, 16].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Haramain');
  const pax = bookings.flatMap((b) =>
    b.passengers.map((p, i) => ({
      'Train Ref': b.trainRef,
      '#': i + 1,
      Name: p.fullName,
      ID: p.idNumber,
      Nationality: p.nationality,
      Category: p.category,
      Coach: p.seatCoach,
      Seat: p.seatNumber,
    }))
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pax.length ? pax : [{ Info: 'No passengers' }]), 'Manifest');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
