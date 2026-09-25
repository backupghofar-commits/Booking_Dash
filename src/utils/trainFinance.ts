import type { Currency, TrainBooking, TrainLeg, TrainPassenger, TrainStationCode } from '../types/train';
import { TRAIN_STATIONS } from '../types/train';
import { convertIDRtoSAR, convertSARtoIDR } from './currency';

export const HARAMAIN_BASE_FARES_SAR: Record<string, { economy: number; business: number; minutes: number }> = {
  'MKK-JED-AIR': { economy: 60, business: 100, minutes: 55 },
  'MKK-JED': { economy: 45, business: 80, minutes: 65 },
  'MKK-KAEC': { economy: 85, business: 145, minutes: 80 },
  'MKK-MDN': { economy: 170, business: 285, minutes: 135 },
  'JED-AIR-JED': { economy: 25, business: 45, minutes: 20 },
  'JED-AIR-KAEC': { economy: 70, business: 120, minutes: 60 },
  'JED-AIR-MDN': { economy: 150, business: 250, minutes: 115 },
  'JED-KAEC': { economy: 60, business: 105, minutes: 50 },
  'JED-MDN': { economy: 140, business: 235, minutes: 105 },
  'KAEC-MDN': { economy: 95, business: 160, minutes: 60 },
};

export function routeKey(a: TrainStationCode, b: TrainStationCode): string {
  return `${a}-${b}`;
}

export function getRouteFare(origin: TrainStationCode, destination: TrainStationCode) {
  const direct = HARAMAIN_BASE_FARES_SAR[routeKey(origin, destination)];
  if (direct) return direct;
  const reversed = HARAMAIN_BASE_FARES_SAR[routeKey(destination, origin)];
  if (reversed) return reversed;
  return { economy: 120, business: 200, minutes: 90 };
}

export function stationShort(code: TrainStationCode): string {
  return TRAIN_STATIONS.find((s) => s.code === code)?.shortName ?? code;
}

export function generateTrainRef(d: Date = new Date()): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `HHR-${d.getFullYear()}-${rand}`;
}

export function legMinutes(depDate: string, depTime: string, arrDate: string, arrTime: string): number {
  if (!depDate || !arrDate) return 0;
  const dep = new Date(`${depDate}T${depTime || '00:00'}:00`);
  const arr = new Date(`${arrDate}T${arrTime || '00:00'}:00`);
  const diff = Math.round((arr.getTime() - dep.getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface TrainTotalsInput {
  passengers: TrainPassenger[];
  costPerPax: number;
  sellPerPax: number;
  extras: { cost: number; sell: number }[];
  tripLegs: number;
  inputCurrency: Currency;
  exchangeRate: number;
}

export function computeTrainTotals(input: TrainTotalsInput) {
  const pax = input.passengers.length;
  const legs = Math.max(1, input.tripLegs);
  const rawCost = pax * (input.costPerPax || 0) * legs + input.extras.reduce((s, e) => s + (e.cost || 0), 0);
  const rawSell = pax * (input.sellPerPax || 0) * legs + input.extras.reduce((s, e) => s + (e.sell || 0), 0);

  let totalCostSAR = 0;
  let totalSellSAR = 0;
  let totalCostIDR = 0;
  let totalSellIDR = 0;
  const rate = input.exchangeRate > 0 ? input.exchangeRate : 4250;

  if (input.inputCurrency === 'SAR') {
    totalCostSAR = rawCost;
    totalSellSAR = rawSell;
    totalCostIDR = convertSARtoIDR(rawCost, rate);
    totalSellIDR = convertSARtoIDR(rawSell, rate);
  } else {
    totalCostIDR = rawCost;
    totalSellIDR = rawSell;
    totalCostSAR = convertIDRtoSAR(rawCost, rate);
    totalSellSAR = convertIDRtoSAR(rawSell, rate);
  }

  const profitSAR = totalSellSAR - totalCostSAR;
  const profitIDR = totalSellIDR - totalCostIDR;
  const profitMarginPercent = totalSellSAR > 0 ? (profitSAR / totalSellSAR) * 100 : 0;

  return {
    paxCount: pax,
    totalCostSAR: Math.round(totalCostSAR * 100) / 100,
    totalSellSAR: Math.round(totalSellSAR * 100) / 100,
    totalCostIDR: Math.round(totalCostIDR),
    totalSellIDR: Math.round(totalSellIDR),
    profitSAR: Math.round(profitSAR * 100) / 100,
    profitIDR: Math.round(profitIDR),
    profitMarginPercent: Math.round(profitMarginPercent * 100) / 100,
  };
}

export function summarizeTrainPayments(
  payments: { amountSAR: number; amountIDR: number }[],
  totalSellSAR: number,
  totalSellIDR: number
) {
  const paidSAR = payments.reduce((s, p) => s + (p.amountSAR || 0), 0);
  const paidIDR = payments.reduce((s, p) => s + (p.amountIDR || 0), 0);
  const remSAR = totalSellSAR - paidSAR;
  const remIDR = totalSellIDR - paidIDR;
  const settled = remSAR <= 0.5 && paidSAR > 0;
  const overpaid = remSAR < -0.5;
  const pct = totalSellSAR > 0 ? Math.min(100, Math.round((paidSAR / totalSellSAR) * 100)) : paidSAR > 0 ? 100 : 0;
  return {
    paidSAR: Math.round(paidSAR * 100) / 100,
    paidIDR: Math.round(paidIDR),
    remSAR: Math.round(remSAR * 100) / 100,
    remIDR: Math.round(remIDR),
    settled,
    overpaid,
    pct,
  };
}

export function autoLegsForTrip(
  tripType: 'One-Way' | 'Round-Trip',
  origin: TrainStationCode,
  destination: TrainStationCode,
  depDate: string,
  depTime: string,
  retDate: string,
  retTime: string,
  trainNoOut = '',
  trainNoRet = ''
): TrainLeg[] {
  const out: TrainLeg = {
    id: `leg-out`,
    direction: 'Outbound',
    trainNo: trainNoOut,
    departureDate: depDate,
    departureTime: depTime,
    arrivalDate: depDate,
    arrivalTime: retTime,
    durationMinutes: legMinutes(depDate, depTime, depDate, ''),
  };
  // arrival date defaults to departure date; duration estimated from route table
  const fare = getRouteFare(origin, destination);
  out.durationMinutes = fare.minutes;
  if (tripType === 'One-Way') return [out];
  const ret: TrainLeg = {
    id: `leg-ret`,
    direction: 'Return',
    trainNo: trainNoRet,
    departureDate: retDate || depDate,
    departureTime: retTime || depTime,
    arrivalDate: retDate || depDate,
    arrivalTime: '',
    durationMinutes: fare.minutes,
  };
  return [out, ret];
}

export function bookingDisplayRoute(b: Pick<TrainBooking, 'originCode' | 'destinationCode' | 'tripType'>): string {
  const o = stationShort(b.originCode);
  const d = stationShort(b.destinationCode);
  return b.tripType === 'Round-Trip' ? `${o} ⇄ ${d}` : `${o} → ${d}`;
}
