import { sqlite, nowIso } from '@/lib/db';
import type { TrainBooking } from '@/types/train';
import {
  recomputeTrain,
  trainToBooking,
  type TrainExtraRow,
  type TrainLegRow,
  type TrainPaxRow,
  type TrainPayRow,
  type TrainRow,
} from '@/lib/mappers/train';
import { assertTransition, type PaymentStatus } from '@/lib/calculations/workflow';

function assemble(row: TrainRow): TrainBooking {
  const legs = sqlite.prepare('SELECT * FROM train_legs WHERE booking_id = ? ORDER BY sort_order').all(row.id) as TrainLegRow[];
  const pax = sqlite.prepare('SELECT * FROM train_passengers WHERE booking_id = ? ORDER BY sort_order').all(row.id) as TrainPaxRow[];
  const extras = sqlite.prepare('SELECT * FROM train_extras WHERE booking_id = ? ORDER BY sort_order').all(row.id) as TrainExtraRow[];
  const payments = sqlite.prepare('SELECT * FROM train_payments WHERE booking_id = ?').all(row.id) as TrainPayRow[];
  return trainToBooking(row, legs, pax, extras, payments);
}

export async function listTrainBookings() {
  const rows = sqlite.prepare('SELECT * FROM train_bookings ORDER BY created_at DESC').all() as TrainRow[];
  return rows.map(assemble);
}

export async function getTrainBooking(id: string) {
  const row = sqlite.prepare('SELECT * FROM train_bookings WHERE id = ?').get(id) as TrainRow | undefined;
  return row ? assemble(row) : null;
}

export async function upsertTrainBooking(input: TrainBooking, isAdmin = false) {
  const existing = sqlite.prepare('SELECT status, created_at FROM train_bookings WHERE id = ?').get(input.id) as
    | { status: string; created_at: string }
    | undefined;
  const computed = recomputeTrain(input);
  if (existing) assertTransition(existing.status as PaymentStatus, computed.status as PaymentStatus, isAdmin);
  const stamp = nowIso();
  const createdAt = existing?.created_at || computed.createdAt || stamp;

  const tx = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO train_bookings (
          id, train_ref, status, staff_name, source, booking_type, customer_name, travel_company,
          customer_phone, customer_email, customer_country, notes, trip_type, origin_code, destination_code,
          train_class, vendor_name, vendor_pic, input_currency, exchange_rate, cost_per_pax, sell_per_pax,
          pax_count, total_cost_sar, total_sell_sar, total_cost_idr, total_sell_idr, profit_sar, profit_idr,
          profit_margin_percent, amount_paid_sar, amount_paid_idr, payment_exchange_rate, payment_method,
          due_date, payment_reference, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          train_ref=excluded.train_ref, status=excluded.status, staff_name=excluded.staff_name, source=excluded.source,
          booking_type=excluded.booking_type, customer_name=excluded.customer_name, travel_company=excluded.travel_company,
          customer_phone=excluded.customer_phone, customer_email=excluded.customer_email, customer_country=excluded.customer_country,
          notes=excluded.notes, trip_type=excluded.trip_type, origin_code=excluded.origin_code, destination_code=excluded.destination_code,
          train_class=excluded.train_class, vendor_name=excluded.vendor_name, vendor_pic=excluded.vendor_pic,
          input_currency=excluded.input_currency, exchange_rate=excluded.exchange_rate, cost_per_pax=excluded.cost_per_pax,
          sell_per_pax=excluded.sell_per_pax, pax_count=excluded.pax_count, total_cost_sar=excluded.total_cost_sar,
          total_sell_sar=excluded.total_sell_sar, total_cost_idr=excluded.total_cost_idr, total_sell_idr=excluded.total_sell_idr,
          profit_sar=excluded.profit_sar, profit_idr=excluded.profit_idr, profit_margin_percent=excluded.profit_margin_percent,
          amount_paid_sar=excluded.amount_paid_sar, amount_paid_idr=excluded.amount_paid_idr,
          payment_exchange_rate=excluded.payment_exchange_rate, payment_method=excluded.payment_method,
          due_date=excluded.due_date, payment_reference=excluded.payment_reference, updated_at=excluded.updated_at`
      )
      .run(
        computed.id, computed.trainRef, computed.status, computed.staffName, computed.source || 'manual',
        computed.bookingType, computed.customerName, computed.travelCompany || null, computed.customerPhone || '',
        computed.customerEmail || '', computed.customerCountry || 'Indonesia', computed.notes || null,
        computed.tripType, computed.originCode, computed.destinationCode, computed.trainClass,
        computed.vendorName || null, computed.vendorPic || null, computed.inputCurrency, computed.exchangeRate,
        computed.costPerPax, computed.sellPerPax, computed.paxCount, computed.totalCostSAR, computed.totalSellSAR,
        computed.totalCostIDR, computed.totalSellIDR, computed.profitSAR, computed.profitIDR, computed.profitMarginPercent,
        computed.amountPaidSAR, computed.amountPaidIDR, computed.paymentExchangeRate || null, computed.paymentMethod,
        computed.dueDate || '', computed.paymentReference || null, createdAt, stamp
      );

    sqlite.prepare('DELETE FROM train_legs WHERE booking_id = ?').run(computed.id);
    sqlite.prepare('DELETE FROM train_passengers WHERE booking_id = ?').run(computed.id);
    sqlite.prepare('DELETE FROM train_extras WHERE booking_id = ?').run(computed.id);
    sqlite.prepare('DELETE FROM train_payments WHERE booking_id = ?').run(computed.id);

    const legStmt = sqlite.prepare(
      `INSERT INTO train_legs (id, booking_id, direction, train_no, departure_date, departure_time, arrival_date, arrival_time, duration_minutes, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    computed.legs.forEach((l, i) =>
      legStmt.run(l.id.startsWith(computed.id) ? l.id : `${computed.id}-${l.id}`, computed.id, l.direction, l.trainNo, l.departureDate, l.departureTime, l.arrivalDate, l.arrivalTime, l.durationMinutes, i)
    );
    const paxStmt = sqlite.prepare(
      `INSERT INTO train_passengers (id, booking_id, full_name, id_number, nationality, category, seat_coach, seat_number, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );
    computed.passengers.forEach((p, i) =>
      paxStmt.run(p.id.startsWith(computed.id) ? p.id : `${computed.id}-${p.id}`, computed.id, p.fullName, p.idNumber, p.nationality, p.category, p.seatCoach, p.seatNumber, i)
    );
    const extraStmt = sqlite.prepare(`INSERT INTO train_extras (id, booking_id, description, cost, sell, sort_order) VALUES (?,?,?,?,?,?)`);
    computed.extras.forEach((e, i) => extraStmt.run(e.id.startsWith(computed.id) ? e.id : `${computed.id}-${e.id}`, computed.id, e.description, e.cost, e.sell, i));
    const payStmt = sqlite.prepare(
      `INSERT INTO train_payments (id, booking_id, paid_at, amount_sar, amount_idr, exchange_rate, method, reference, note)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );
    computed.paymentHistory.forEach((p) =>
      payStmt.run(p.id.startsWith(computed.id) ? p.id : `${computed.id}-${p.id}`, computed.id, p.date, p.amountSAR, p.amountIDR, p.exchangeRate, p.method, p.reference || null, p.note || null)
    );
  });
  tx();
  const saved = await getTrainBooking(computed.id);
  if (!saved) throw new Error('Failed to persist train booking');
  return saved;
}

export async function deleteTrainBooking(id: string) {
  sqlite.prepare('DELETE FROM train_bookings WHERE id = ?').run(id);
}
