import type { ArmadaBooking, ArmadaLeg, ArmadaLocationCode, ArmadaUnit, Currency, VehicleType } from '../types/armada';
import { ARMADA_LOCATIONS, VEHICLE_CAPACITY } from '../types/armada';
import { convertIDRtoSAR, convertSARtoIDR } from './currency';

// Indicative base charter price (SAR) for a reference Hiace, per one-way route.
export const ARMADA_ROUTE_BASE_SAR: Record<string, { base: number; minutes: number }> = {
  'JED-AIR-MKK': { base: 350, minutes: 75 },
  'JED-AIR-MDN': { base: 950, minutes: 360 },
  'JED-AIR-JED': { base: 120, minutes: 30 },
  'MKK-MDN': { base: 700, minutes: 300 },
  'MKK-JED': { base: 300, minutes: 70 },
  'MKK-TAIF': { base: 400, minutes: 90 },
  'MDN-MED-AIR': { base: 180, minutes: 40 },
  'MDN-JED-AIR': { base: 950, minutes: 360 },
};

// Multiplier applied to the reference (Hiace) base price per vehicle type.
export const VEHICLE_FARE_MULTIPLIER: Record<VehicleType, number> = {
  'Sedan 4 Seat': 0.8,
  'Hiace 13 Seat': 1.0,
  'GMC 7 Seat': 1.3,
  'Coaster 23 Seat': 1.6,
  'Bus 45 Seat': 2.4,
  'Bus 50 Seat': 2.6,
};

export function routeKey(a: ArmadaLocationCode, b: ArmadaLocationCode): string {
  return `${a}-${b}`;
}

export function getRouteFare(origin: ArmadaLocationCode, destination: ArmadaLocationCode) {
  const direct = ARMADA_ROUTE_BASE_SAR[routeKey(origin, destination)];
  if (direct) return direct;
  const reversed = ARMADA_ROUTE_BASE_SAR[routeKey(destination, origin)];
  if (reversed) return reversed;
  return { base: 500, minutes: 120 };
}

// Suggested buy price (SAR) for a given route + vehicle type, per unit per leg.
export function fareForVehicle(origin: ArmadaLocationCode, destination: ArmadaLocationCode, type: VehicleType): number {
  const { base } = getRouteFare(origin, destination);
  return Math.round(base * (VEHICLE_FARE_MULTIPLIER[type] ?? 1));
}

export function locationShort(code: ArmadaLocationCode): string {
  return ARMADA_LOCATIONS.find((s) => s.code === code)?.shortName ?? code;
}

export function generateArmadaRef(d: Date = new Date()): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AMD-${d.getFullYear()}-${rand}`;
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

export function unitSeats(units: ArmadaUnit[]): number {
  return units.reduce((s, u) => s + (u.capacity || VEHICLE_CAPACITY[u.vehicleType] || 0), 0);
}

export interface ArmadaTotalsInput {
  units: ArmadaUnit[];
  costPerUnit: number;
  sellPerUnit: number;
  extras: { cost: number; sell: number }[];
  tripLegs: number;
  inputCurrency: Currency;
  exchangeRate: number;
}

export function computeArmadaTotals(input: ArmadaTotalsInput) {
  const units = input.units.length;
  const legs = Math.max(1, input.tripLegs);
  const rawCost = units * (input.costPerUnit || 0) * legs + input.extras.reduce((s, e) => s + (e.cost || 0), 0);
  const rawSell = units * (input.sellPerUnit || 0) * legs + input.extras.reduce((s, e) => s + (e.sell || 0), 0);

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
    unitCount: units,
    totalSeats: unitSeats(input.units),
    totalCostSAR: Math.round(totalCostSAR * 100) / 100,
    totalSellSAR: Math.round(totalSellSAR * 100) / 100,
    totalCostIDR: Math.round(totalCostIDR),
    totalSellIDR: Math.round(totalSellIDR),
    profitSAR: Math.round(profitSAR * 100) / 100,
    profitIDR: Math.round(profitIDR),
    profitMarginPercent: Math.round(profitMarginPercent * 100) / 100,
  };
}

export function summarizeArmadaPayments(
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

export function autoLegsForService(
  serviceType: ServiceTypeArg,
  origin: ArmadaLocationCode,
  destination: ArmadaLocationCode,
  depDate: string,
  depTime: string,
  retDate: string,
  retTime: string
): ArmadaLeg[] {
  const fare = getRouteFare(origin, destination);
  const out: ArmadaLeg = {
    id: 'leg-out',
    direction: 'Outbound',
    routeLabel: `${locationShort(origin)} → ${locationShort(destination)}`,
    departureDate: depDate,
    departureTime: depTime,
    arrivalDate: depDate,
    arrivalTime: '',
    durationMinutes: fare.minutes,
  };
  if (serviceType === 'One-Way') return [out];
  const ret: ArmadaLeg = {
    id: 'leg-ret',
    direction: 'Return',
    routeLabel: `${locationShort(destination)} → ${locationShort(origin)}`,
    departureDate: retDate || depDate,
    departureTime: retTime || depTime,
    arrivalDate: retDate || depDate,
    arrivalTime: '',
    durationMinutes: fare.minutes,
  };
  return [out, ret];
}

type ServiceTypeArg = 'One-Way' | 'Round-Trip';

export function bookingDisplayRoute(b: Pick<ArmadaBooking, 'originCode' | 'destinationCode' | 'serviceType'>): string {
  const o = locationShort(b.originCode);
  const d = locationShort(b.destinationCode);
  return b.serviceType === 'Round-Trip' ? `${o} ⇄ ${d}` : `${o} → ${d}`;
}
