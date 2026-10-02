import type { TrainBooking, TrainLeg, TrainPassenger, TrainExtraItem, TrainPayment } from '@/types/train';
import { computeTrainTotals } from '@/utils/trainFinance';
import { derivePaymentStatus, roundIDR, roundPct, roundSAR, type PaymentStatus } from '@/lib/calculations/workflow';

export type TrainRow = {
  id: string;
  train_ref: string;
  status: string;
  staff_name: string;
  source: string;
  booking_type: string;
  customer_name: string;
  travel_company: string | null;
  customer_phone: string;
  customer_email: string;
  customer_country: string;
  notes: string | null;
  trip_type: string;
  origin_code: string;
  destination_code: string;
  train_class: string;
  vendor_name: string | null;
  vendor_pic: string | null;
  input_currency: string;
  exchange_rate: number;
  cost_per_pax: number;
  sell_per_pax: number;
  pax_count: number;
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

export type TrainLegRow = {
  id: string;
  direction: string;
  train_no: string;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  duration_minutes: number;
  sort_order: number;
};

export type TrainPaxRow = {
  id: string;
  full_name: string;
  id_number: string;
  nationality: string;
  category: string;
  seat_coach: string;
  seat_number: string;
  sort_order: number;
};

export type TrainExtraRow = { id: string; description: string; cost: number; sell: number; sort_order: number };
export type TrainPayRow = {
  id: string;
  paid_at: string;
  amount_sar: number;
  amount_idr: number;
  exchange_rate: number;
  method: string;
  reference: string | null;
  note: string | null;
};

export function trainToBooking(row: TrainRow, legs: TrainLegRow[], pax: TrainPaxRow[], extras: TrainExtraRow[], payments: TrainPayRow[]): TrainBooking {
  return {
    id: row.id,
    trainRef: row.train_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as TrainBooking['status'],
    staffName: row.staff_name,
    source: (row.source as TrainBooking['source']) || 'manual',
    bookingType: row.booking_type as TrainBooking['bookingType'],
    customerName: row.customer_name,
    travelCompany: row.travel_company ?? undefined,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    customerCountry: row.customer_country,
    notes: row.notes ?? undefined,
    tripType: row.trip_type as TrainBooking['tripType'],
    originCode: row.origin_code as TrainBooking['originCode'],
    destinationCode: row.destination_code as TrainBooking['destinationCode'],
    trainClass: row.train_class as TrainBooking['trainClass'],
    vendorName: row.vendor_name ?? undefined,
    vendorPic: row.vendor_pic ?? undefined,
    inputCurrency: row.input_currency as TrainBooking['inputCurrency'],
    exchangeRate: row.exchange_rate,
    costPerPax: row.cost_per_pax,
    sellPerPax: row.sell_per_pax,
    paxCount: row.pax_count,
    legs: legs
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (l): TrainLeg => ({
          id: l.id,
          direction: l.direction as TrainLeg['direction'],
          trainNo: l.train_no,
          departureDate: l.departure_date,
          departureTime: l.departure_time,
          arrivalDate: l.arrival_date,
          arrivalTime: l.arrival_time,
          durationMinutes: l.duration_minutes,
        })
      ),
    passengers: pax
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (p): TrainPassenger => ({
          id: p.id,
          fullName: p.full_name,
          idNumber: p.id_number,
          nationality: p.nationality,
          category: p.category as TrainPassenger['category'],
          seatCoach: p.seat_coach,
          seatNumber: p.seat_number,
        })
      ),
    extras: extras
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((e): TrainExtraItem => ({ id: e.id, description: e.description, cost: e.cost, sell: e.sell })),
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
    paymentMethod: row.payment_method as TrainBooking['paymentMethod'],
    dueDate: row.due_date,
    paymentReference: row.payment_reference ?? undefined,
    paymentHistory: payments.map(
      (p): TrainPayment => ({
        id: p.id,
        date: p.paid_at,
        amountSAR: p.amount_sar,
        amountIDR: p.amount_idr,
        exchangeRate: p.exchange_rate,
        method: p.method as TrainPayment['method'],
        reference: p.reference ?? undefined,
        note: p.note ?? undefined,
      })
    ),
  };
}

export function recomputeTrain(booking: TrainBooking): TrainBooking {
  const totals = computeTrainTotals({
    passengers: booking.passengers,
    costPerPax: booking.costPerPax,
    sellPerPax: booking.sellPerPax,
    extras: booking.extras,
    tripLegs: Math.max(1, booking.legs.length),
    inputCurrency: booking.inputCurrency,
    exchangeRate: booking.exchangeRate,
  });
  const paidSAR = roundSAR((booking.paymentHistory || []).reduce((s, p) => s + (p.amountSAR || 0), 0));
  const paidIDR = roundIDR((booking.paymentHistory || []).reduce((s, p) => s + (p.amountIDR || 0), 0));
  return {
    ...booking,
    paxCount: totals.paxCount,
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
