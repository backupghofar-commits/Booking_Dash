import type { ArmadaBooking, ArmadaLeg, ArmadaUnit, ArmadaExtraItem, ArmadaPayment } from '@/types/armada';
import { computeArmadaTotals } from '@/utils/armadaFinance';
import { derivePaymentStatus, roundIDR, roundPct, roundSAR, type PaymentStatus } from '@/lib/calculations/workflow';

export type ArmadaRow = {
  id: string;
  armada_ref: string;
  status: string;
  staff_name: string;
  source: string;
  booking_type: string;
  customer_name: string;
  travel_company: string | null;
  customer_phone: string;
  customer_email: string;
  customer_country: string;
  group_size: number;
  notes: string | null;
  service_type: string;
  origin_code: string;
  destination_code: string;
  vehicle_type: string;
  vendor_name: string | null;
  vendor_pic: string | null;
  input_currency: string;
  exchange_rate: number;
  cost_per_unit: number;
  sell_per_unit: number;
  unit_count: number;
  total_seats: number;
  total_cost_sar: number;
  total_sell_sar: number;
  total_cost_idr: number;
  total_sell_idr: number;
  profit_sar: number;
  profit_idr: number;
  profit_margin_percent: number;
  amount_paid_sar: number;
  amount_paid_idr: number;
  payment_exchange_rate: number | null;
  payment_method: string;
  due_date: string;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type ArmadaLegRow = {
  id: string;
  direction: string;
  route_label: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  duration_minutes: number;
  sort_order: number;
};
export type ArmadaUnitRow = {
  id: string;
  vehicle_type: string;
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  capacity: number;
  note: string;
  sort_order: number;
};
export type ArmadaExtraRow = { id: string; description: string; cost: number; sell: number; sort_order: number };
export type ArmadaPayRow = {
  id: string;
  paid_at: string;
  amount_sar: number;
  amount_idr: number;
  exchange_rate: number;
  method: string;
  reference: string | null;
  note: string | null;
};

export function armadaToBooking(
  row: ArmadaRow,
  legs: ArmadaLegRow[],
  units: ArmadaUnitRow[],
  extras: ArmadaExtraRow[],
  payments: ArmadaPayRow[]
): ArmadaBooking {
  return {
    id: row.id,
    armadaRef: row.armada_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as ArmadaBooking['status'],
    staffName: row.staff_name,
    source: (row.source as ArmadaBooking['source']) || 'manual',
    bookingType: row.booking_type as ArmadaBooking['bookingType'],
    customerName: row.customer_name,
    travelCompany: row.travel_company ?? undefined,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    customerCountry: row.customer_country,
    groupSize: row.group_size,
    notes: row.notes ?? undefined,
    serviceType: row.service_type as ArmadaBooking['serviceType'],
    originCode: row.origin_code as ArmadaBooking['originCode'],
    destinationCode: row.destination_code as ArmadaBooking['destinationCode'],
    vehicleType: row.vehicle_type as ArmadaBooking['vehicleType'],
    vendorName: row.vendor_name ?? undefined,
    vendorPic: row.vendor_pic ?? undefined,
    inputCurrency: row.input_currency as ArmadaBooking['inputCurrency'],
    exchangeRate: row.exchange_rate,
    costPerUnit: row.cost_per_unit,
    sellPerUnit: row.sell_per_unit,
    unitCount: row.unit_count,
    totalSeats: row.total_seats,
    legs: legs
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (l): ArmadaLeg => ({
          id: l.id,
          direction: l.direction as ArmadaLeg['direction'],
          routeLabel: l.route_label,
          departureDate: l.departure_date,
          departureTime: l.departure_time,
          arrivalDate: l.arrival_date,
          arrivalTime: l.arrival_time,
          durationMinutes: l.duration_minutes,
        })
      ),
    units: units
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (u): ArmadaUnit => ({
          id: u.id,
          vehicleType: u.vehicle_type as ArmadaUnit['vehicleType'],
          plateNumber: u.plate_number,
          driverName: u.driver_name,
          driverPhone: u.driver_phone,
          capacity: u.capacity,
          note: u.note,
        })
      ),
    extras: extras
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((e): ArmadaExtraItem => ({ id: e.id, description: e.description, cost: e.cost, sell: e.sell })),
    totalCostSAR: row.total_cost_sar,
    totalSellSAR: row.total_sell_sar,
    totalCostIDR: row.total_cost_idr,
    totalSellIDR: row.total_sell_idr,
    profitSAR: row.profit_sar,
    profitIDR: row.profit_idr,
    profitMarginPercent: row.profit_margin_percent,
    amountPaidSAR: row.amount_paid_sar,
    amountPaidIDR: row.amount_paid_idr,
    paymentExchangeRate: row.payment_exchange_rate ?? undefined,
    paymentMethod: row.payment_method as ArmadaBooking['paymentMethod'],
    dueDate: row.due_date,
    paymentReference: row.payment_reference ?? undefined,
    paymentHistory: payments.map(
      (p): ArmadaPayment => ({
        id: p.id,
        date: p.paid_at,
        amountSAR: p.amount_sar,
        amountIDR: p.amount_idr,
        exchangeRate: p.exchange_rate,
        method: p.method as ArmadaPayment['method'],
        reference: p.reference ?? undefined,
        note: p.note ?? undefined,
      })
    ),
  };
}

export function recomputeArmada(booking: ArmadaBooking): ArmadaBooking {
  const totals = computeArmadaTotals({
    units: booking.units,
    costPerUnit: booking.costPerUnit,
    sellPerUnit: booking.sellPerUnit,
    extras: booking.extras,
    tripLegs: Math.max(1, booking.legs.length),
    inputCurrency: booking.inputCurrency,
    exchangeRate: booking.exchangeRate,
  });
  const paidSAR = roundSAR((booking.paymentHistory || []).reduce((s, p) => s + (p.amountSAR || 0), 0));
  const paidIDR = roundIDR((booking.paymentHistory || []).reduce((s, p) => s + (p.amountIDR || 0), 0));
  return {
    ...booking,
    unitCount: totals.unitCount,
    totalSeats: totals.totalSeats,
    totalCostSAR: totals.totalCostSAR,
    totalSellSAR: totals.totalSellSAR,
    totalCostIDR: totals.totalCostIDR,
    totalSellIDR: totals.totalSellIDR,
    profitSAR: totals.profitSAR,
    profitIDR: totals.profitIDR,
    profitMarginPercent: roundPct(totals.profitMarginPercent),
    amountPaidSAR: paidSAR,
    amountPaidIDR: paidIDR,
    status: derivePaymentStatus(booking.status as PaymentStatus, paidSAR, totals.totalSellSAR),
  };
}
