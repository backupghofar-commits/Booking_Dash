import type { Booking, PaymentRecord, RoomDetail, AdditionalCostItem } from '@/types/booking';
import { computeBookingTotals } from '@/utils/currency';
import { derivePaymentStatus, roundIDR, roundPct, roundSAR, type PaymentStatus } from '@/lib/calculations/workflow';

export type HotelBookingRow = {
  id: string;
  booking_ref: string;
  status: string;
  staff_name: string;
  source: string;
  visa_action: string | null;
  booking_type: string;
  travel_company: string | null;
  vendor_name: string | null;
  vendor_pic: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_passport: string;
  customer_country: string;
  adults: number;
  children: number;
  infants: number;
  notes: string | null;
  hotel_name: string;
  hotel_city: string;
  star_rating: number;
  check_in_date: string;
  check_out_date: string;
  total_nights: number;
  hcn_rsvp: string | null;
  hotel_transfer_json: string | null;
  import_source_json: string | null;
  input_currency: string;
  exchange_rate: number;
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

export type RoomRow = {
  id: string;
  booking_id: string;
  room_type: string;
  number_of_rooms: number;
  cost_per_night: number;
  sell_per_night: number;
  meal_plan: string;
  sort_order: number;
};

export type ServiceRow = {
  id: string;
  booking_id: string;
  description: string;
  cost: number;
  sell: number;
  sort_order: number;
};

export type HotelPayRow = {
  id: string;
  booking_id: string;
  paid_at: string;
  amount_sar: number;
  amount_idr: number;
  exchange_rate: number | null;
  direction: string;
  method: string;
  reference: string | null;
  note: string | null;
};

export function hotelToBooking(row: HotelBookingRow, rooms: RoomRow[], services: ServiceRow[], payments: HotelPayRow[]): Booking {
  const customerPayments = payments.filter((p) => p.direction !== 'vendor');
  const vendorPayments = payments.filter((p) => p.direction === 'vendor');
  const mapPay = (p: HotelPayRow): PaymentRecord => ({
    id: p.id,
    date: p.paid_at,
    amountSAR: p.amount_sar,
    amountIDR: p.amount_idr,
    exchangeRate: p.exchange_rate ?? undefined,
    direction: p.direction === 'vendor' ? 'vendor' : 'customer',
    method: p.method as PaymentRecord['method'],
    reference: p.reference ?? undefined,
    note: p.note ?? undefined,
  });

  return {
    id: row.id,
    bookingRef: row.booking_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as Booking['status'],
    staffName: row.staff_name,
    source: (row.source as Booking['source']) || 'manual',
    visaAction: (row.visa_action as Booking['visaAction']) || undefined,
    paymentHistory: customerPayments.map(mapPay),
    vendorPayments: vendorPayments.map(mapPay),
    bookingType: (row.booking_type as Booking['bookingType']) || 'Private',
    travelCompany: row.travel_company ?? undefined,
    vendorName: row.vendor_name ?? undefined,
    vendorPic: row.vendor_pic ?? undefined,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    customerPassport: row.customer_passport,
    customerCountry: row.customer_country,
    groupSize: { adults: row.adults, children: row.children, infants: row.infants },
    notes: row.notes ?? undefined,
    hotelName: row.hotel_name,
    hotelCity: row.hotel_city as Booking['hotelCity'],
    starRating: row.star_rating,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    totalNights: row.total_nights,
    hcnRsvp: row.hcn_rsvp ?? undefined,
    hotelTransfer: row.hotel_transfer_json ? JSON.parse(row.hotel_transfer_json) : undefined,
    importSource: row.import_source_json ? JSON.parse(row.import_source_json) : undefined,
    inputCurrency: row.input_currency as Booking['inputCurrency'],
    exchangeRate: row.exchange_rate,
    rooms: rooms
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (r): RoomDetail => ({
          id: r.id,
          roomType: r.room_type,
          numberOfRooms: r.number_of_rooms,
          costPerNight: r.cost_per_night,
          sellPerNight: r.sell_per_night,
          mealPlan: r.meal_plan as RoomDetail['mealPlan'],
        })
      ),
    additionalServices: services
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(
        (s): AdditionalCostItem => ({
          id: s.id,
          description: s.description,
          cost: s.cost,
          sell: s.sell,
        })
      ),
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
    paymentMethod: row.payment_method as Booking['paymentMethod'],
    dueDate: row.due_date,
    paymentReference: row.payment_reference ?? undefined,
  };
}

export function recomputeHotel(booking: Booking): Booking {
  const nights = booking.totalNights > 0 ? booking.totalNights : 1;
  const totals = computeBookingTotals(
    booking.rooms,
    booking.additionalServices,
    nights,
    booking.inputCurrency,
    booking.exchangeRate,
    0,
    booking.paymentExchangeRate
  );
  const customerPays = booking.paymentHistory || [];
  const paidSAR = roundSAR(customerPays.reduce((s, p) => s + (p.amountSAR || 0), 0));
  const paidIDR = roundIDR(customerPays.reduce((s, p) => s + (p.amountIDR || 0), 0));
  const status = derivePaymentStatus(booking.status as PaymentStatus, paidSAR, totals.totalSellSAR);
  return {
    ...booking,
    totalCostSAR: roundSAR(totals.totalCostSAR),
    totalSellSAR: roundSAR(totals.totalSellSAR),
    totalCostIDR: roundIDR(totals.totalCostIDR),
    totalSellIDR: roundIDR(totals.totalSellIDR),
    profitSAR: roundSAR(totals.profitSAR),
    profitIDR: roundIDR(totals.profitIDR),
    profitMarginPercent: roundPct(totals.profitMarginPercent),
    amountPaidSAR: paidSAR,
    amountPaidIDR: paidIDR,
    status,
  };
}
