import * as XLSX from 'xlsx';
import type { CompanySettings } from '../types/booking';
import type { ArmadaBooking } from '../types/armada';
import { ARMADA_LOCATIONS } from '../types/armada';
import { bookingDisplayRoute } from './armadaFinance';
import { formatIDR, formatSAR } from './currency';

export { exportSinglePagePDF } from './export';

const st = (code: string) => ARMADA_LOCATIONS.find((s) => s.code === code)?.shortName ?? code;

export function getArmadaWhatsAppMessage(b: ArmadaBooking, settings: CompanySettings): string {
  const balSAR = b.totalSellSAR - b.amountPaidSAR;
  const balIDR = b.totalSellIDR - b.amountPaidIDR;
  const legs = b.legs.map((l) => `• ${l.direction}: ${l.routeLabel} · ${l.departureDate} ${l.departureTime}`).join('\n');
  const fleet = b.units.map((u) => `• ${u.vehicleType}${u.plateNumber ? ` (${u.plateNumber})` : ''}${u.driverName ? ` — ${u.driverName}` : ''}`).join('\n');
  return `*${settings.legalEntityName || settings.companyName}*\n*UMROH FLEET CHARTER VOUCHER*\n\n*Ref:* ${b.armadaRef}\n*Customer:* ${b.travelCompany || b.customerName}\n*Route:* ${bookingDisplayRoute(b)}\n${legs}\n*Vehicle:* ${b.vehicleType} × ${b.unitCount} unit\n*Jamaah:* ${b.groupSize} pax · ${b.totalSeats} seats\n${fleet ? `\n${fleet}\n` : ''}\n*TOTAL:* ${formatSAR(b.totalSellSAR)} / ${formatIDR(b.totalSellIDR)}\n*PAID:* ${formatSAR(b.amountPaidSAR)} / ${formatIDR(b.amountPaidIDR)}\n*BALANCE:* ${formatSAR(balSAR)} / ${formatIDR(balIDR)}\n*STATUS:* *${b.status.toUpperCase()}*\n\nDriver will contact the group leader before pickup.`;
}

export function shareArmadaViaWhatsApp(b: ArmadaBooking, settings: CompanySettings) {
  const clean = b.customerPhone.replace(/[^0-9]/g, '');
  const url = clean
    ? `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(getArmadaWhatsAppMessage(b, settings))}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(getArmadaWhatsAppMessage(b, settings))}`;
  window.open(url, '_blank');
}

export function shareArmadaViaEmail(b: ArmadaBooking, settings: CompanySettings) {
  const subject = `[Umroh Fleet Charter] ${b.armadaRef} - ${b.customerName}`;
  window.location.href = `mailto:${b.customerEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(getArmadaWhatsAppMessage(b, settings))}`;
}

export function exportArmadaToExcel(bookings: ArmadaBooking[], filename = 'TAMIMA_Armada_Umroh_Report') {
  const rows = bookings.map((b) => ({
    'Armada Ref': b.armadaRef,
    Status: b.status,
    Customer: b.travelCompany || b.customerName,
    Phone: b.customerPhone,
    Route: `${st(b.originCode)} → ${st(b.destinationCode)}`,
    Service: b.serviceType,
    Vehicle: b.vehicleType,
    Units: b.unitCount,
    Seats: b.totalSeats,
    Jamaah: b.groupSize,
    Departure: `${b.legs[0]?.departureDate || ''} ${b.legs[0]?.departureTime || ''}`,
    'Cost/unit (SAR)': b.costPerUnit,
    'Sell/unit (SAR)': b.sellPerUnit,
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
  ws['!cols'] = [16, 10, 24, 16, 22, 11, 15, 6, 6, 7, 20, 13, 13, 12, 12, 12, 9, 12, 13, 14, 18, 16].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Armada Umroh');
  const fleet = bookings.flatMap((b) =>
    b.units.map((u, i) => ({
      'Armada Ref': b.armadaRef,
      '#': i + 1,
      Vehicle: u.vehicleType,
      Plate: u.plateNumber,
      Capacity: u.capacity,
      Driver: u.driverName,
      'Driver Phone': u.driverPhone,
      Note: u.note,
    }))
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fleet.length ? fleet : [{ Info: 'No units' }]), 'Fleet Manifest');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
