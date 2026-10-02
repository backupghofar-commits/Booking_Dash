import { sqlite, nowIso } from '@/lib/db';
import type { Booking } from '@/types/booking';
import {
  hotelToBooking,
  recomputeHotel,
  type HotelBookingRow,
  type HotelPayRow,
  type RoomRow,
  type ServiceRow,
} from '@/lib/mappers/hotel';
import { assertTransition, type PaymentStatus } from '@/lib/calculations/workflow';

function assemble(row: HotelBookingRow): Booking {
  const rooms = sqlite.prepare('SELECT * FROM booking_rooms WHERE booking_id = ? ORDER BY sort_order').all(row.id) as RoomRow[];
  const services = sqlite.prepare('SELECT * FROM booking_services WHERE booking_id = ? ORDER BY sort_order').all(row.id) as ServiceRow[];
  const payments = sqlite.prepare('SELECT * FROM hotel_payments WHERE booking_id = ?').all(row.id) as HotelPayRow[];
  return hotelToBooking(row, rooms, services, payments);
}

export async function listHotelBookings() {
  const rows = sqlite.prepare('SELECT * FROM hotel_bookings ORDER BY created_at DESC').all() as HotelBookingRow[];
  return rows.map(assemble);
}

export async function getHotelBooking(id: string) {
  const row = sqlite.prepare('SELECT * FROM hotel_bookings WHERE id = ?').get(id) as HotelBookingRow | undefined;
  return row ? assemble(row) : null;
}

export async function upsertHotelBooking(input: Booking, isAdmin = false) {
  const existing = sqlite.prepare('SELECT status FROM hotel_bookings WHERE id = ?').get(input.id) as { status: string } | undefined;
  const computed = recomputeHotel({
    ...input,
    status: existing ? input.status : input.status || 'Unpaid',
  });
  if (existing) {
    assertTransition(existing.status as PaymentStatus, computed.status as PaymentStatus, isAdmin);
  }

  const stamp = nowIso();
  const createdAt = existing ? (sqlite.prepare('SELECT created_at FROM hotel_bookings WHERE id = ?').get(computed.id) as { created_at: string }).created_at : computed.createdAt || stamp;

  const tx = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO hotel_bookings (
          id, booking_ref, status, staff_name, source, visa_action, booking_type, travel_company,
          vendor_name, vendor_pic, customer_name, customer_phone, customer_email, customer_passport,
          customer_country, adults, children, infants, notes, hotel_name, hotel_city, star_rating,
          check_in_date, check_out_date, total_nights, hcn_rsvp, hotel_transfer_json, import_source_json,
          input_currency, exchange_rate, total_cost_sar, total_sell_sar, total_cost_idr, total_sell_idr,
          profit_sar, profit_idr, profit_margin_percent, amount_paid_sar, amount_paid_idr,
          payment_exchange_rate, payment_method, due_date, payment_reference, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          booking_ref=excluded.booking_ref, status=excluded.status, staff_name=excluded.staff_name,
          source=excluded.source, visa_action=excluded.visa_action, booking_type=excluded.booking_type,
          travel_company=excluded.travel_company, vendor_name=excluded.vendor_name, vendor_pic=excluded.vendor_pic,
          customer_name=excluded.customer_name, customer_phone=excluded.customer_phone, customer_email=excluded.customer_email,
          customer_passport=excluded.customer_passport, customer_country=excluded.customer_country,
          adults=excluded.adults, children=excluded.children, infants=excluded.infants, notes=excluded.notes,
          hotel_name=excluded.hotel_name, hotel_city=excluded.hotel_city, star_rating=excluded.star_rating,
          check_in_date=excluded.check_in_date, check_out_date=excluded.check_out_date, total_nights=excluded.total_nights,
          hcn_rsvp=excluded.hcn_rsvp, hotel_transfer_json=excluded.hotel_transfer_json, import_source_json=excluded.import_source_json,
          input_currency=excluded.input_currency, exchange_rate=excluded.exchange_rate, total_cost_sar=excluded.total_cost_sar,
          total_sell_sar=excluded.total_sell_sar, total_cost_idr=excluded.total_cost_idr, total_sell_idr=excluded.total_sell_idr,
          profit_sar=excluded.profit_sar, profit_idr=excluded.profit_idr, profit_margin_percent=excluded.profit_margin_percent,
          amount_paid_sar=excluded.amount_paid_sar, amount_paid_idr=excluded.amount_paid_idr,
          payment_exchange_rate=excluded.payment_exchange_rate, payment_method=excluded.payment_method,
          due_date=excluded.due_date, payment_reference=excluded.payment_reference, updated_at=excluded.updated_at`
      )
      .run(
        computed.id,
        computed.bookingRef,
        computed.status,
        computed.staffName,
        computed.source || 'manual',
        computed.visaAction || null,
        computed.bookingType || 'Private',
        computed.travelCompany || null,
        computed.vendorName || null,
        computed.vendorPic || null,
        computed.customerName,
        computed.customerPhone || '',
        computed.customerEmail || '',
        computed.customerPassport || '',
        computed.customerCountry || 'Indonesia',
        computed.groupSize?.adults || 0,
        computed.groupSize?.children || 0,
        computed.groupSize?.infants || 0,
        computed.notes || null,
        computed.hotelName,
        computed.hotelCity,
        computed.starRating || 5,
        computed.checkInDate,
        computed.checkOutDate,
        computed.totalNights,
        computed.hcnRsvp || null,
        computed.hotelTransfer ? JSON.stringify(computed.hotelTransfer) : null,
        computed.importSource ? JSON.stringify(computed.importSource) : null,
        computed.inputCurrency,
        computed.exchangeRate,
        computed.totalCostSAR,
        computed.totalSellSAR,
        computed.totalCostIDR,
        computed.totalSellIDR,
        computed.profitSAR,
        computed.profitIDR,
        computed.profitMarginPercent,
        computed.amountPaidSAR,
        computed.amountPaidIDR,
        computed.paymentExchangeRate || null,
        computed.paymentMethod,
        computed.dueDate || '',
        computed.paymentReference || null,
        createdAt,
        stamp
      );

    sqlite.prepare('DELETE FROM booking_rooms WHERE booking_id = ?').run(computed.id);
    sqlite.prepare('DELETE FROM booking_services WHERE booking_id = ?').run(computed.id);
    sqlite.prepare('DELETE FROM hotel_payments WHERE booking_id = ?').run(computed.id);

    const roomStmt = sqlite.prepare(
      `INSERT INTO booking_rooms (id, booking_id, room_type, number_of_rooms, cost_per_night, sell_per_night, meal_plan, sort_order)
       VALUES (?,?,?,?,?,?,?,?)`
    );
    computed.rooms.forEach((r, i) =>
      roomStmt.run(r.id.startsWith(computed.id) ? r.id : `${computed.id}-${r.id}`, computed.id, r.roomType, r.numberOfRooms, r.costPerNight, r.sellPerNight, r.mealPlan, i)
    );

    const svcStmt = sqlite.prepare(
      `INSERT INTO booking_services (id, booking_id, description, cost, sell, sort_order) VALUES (?,?,?,?,?,?)`
    );
    computed.additionalServices.forEach((s, i) => svcStmt.run(s.id.startsWith(computed.id) ? s.id : `${computed.id}-${s.id}`, computed.id, s.description, s.cost, s.sell, i));

    const payStmt = sqlite.prepare(
      `INSERT INTO hotel_payments (id, booking_id, paid_at, amount_sar, amount_idr, exchange_rate, direction, method, reference, note)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    const pays = [
      ...(computed.paymentHistory || []).map((p) => ({ ...p, direction: p.direction || 'customer' })),
      ...(computed.vendorPayments || []).map((p) => ({ ...p, direction: 'vendor' as const })),
    ];
    pays.forEach((p) =>
      payStmt.run(p.id.startsWith(computed.id) ? p.id : `${computed.id}-${p.id}`, computed.id, p.date, p.amountSAR, p.amountIDR, p.exchangeRate || null, p.direction || 'customer', p.method, p.reference || null, p.note || null)
    );
  });
  tx();

  const saved = await getHotelBooking(computed.id);
  if (!saved) throw new Error('Failed to persist hotel booking');
  return saved;
}

export async function deleteHotelBooking(id: string) {
  sqlite.prepare('DELETE FROM hotel_bookings WHERE id = ?').run(id);
}
