import { sqlite, nowIso } from '@/lib/db';
import type { ArmadaBooking } from '@/types/armada';
import {
  armadaToBooking,
  recomputeArmada,
  type ArmadaExtraRow,
  type ArmadaLegRow,
  type ArmadaPayRow,
  type ArmadaRow,
  type ArmadaUnitRow,
} from '@/lib/mappers/armada';
import { assertTransition, type PaymentStatus } from '@/lib/calculations/workflow';

function assemble(row: ArmadaRow): ArmadaBooking {
  const legs = sqlite.prepare('SELECT * FROM armada_legs WHERE booking_id = ? ORDER BY sort_order').all(row.id) as ArmadaLegRow[];
  const units = sqlite.prepare('SELECT * FROM armada_units WHERE booking_id = ? ORDER BY sort_order').all(row.id) as ArmadaUnitRow[];
  const extras = sqlite.prepare('SELECT * FROM armada_extras WHERE booking_id = ? ORDER BY sort_order').all(row.id) as ArmadaExtraRow[];
  const payments = sqlite.prepare('SELECT * FROM armada_payments WHERE booking_id = ?').all(row.id) as ArmadaPayRow[];
  return armadaToBooking(row, legs, units, extras, payments);
}

export async function listArmadaBookings() {
  const rows = sqlite.prepare('SELECT * FROM armada_bookings ORDER BY created_at DESC').all() as ArmadaRow[];
  return rows.map(assemble);
}

export async function getArmadaBooking(id: string) {
  const row = sqlite.prepare('SELECT * FROM armada_bookings WHERE id = ?').get(id) as ArmadaRow | undefined;
  return row ? assemble(row) : null;
}

export async function upsertArmadaBooking(input: ArmadaBooking, isAdmin = false) {
  const existing = sqlite.prepare('SELECT status, created_at FROM armada_bookings WHERE id = ?').get(input.id) as
    | { status: string; created_at: string }
    | undefined;
  const computed = recomputeArmada(input);
  if (existing) assertTransition(existing.status as PaymentStatus, computed.status as PaymentStatus, isAdmin);
  const stamp = nowIso();
  const createdAt = existing?.created_at || computed.createdAt || stamp;

  const tx = sqlite.transaction(() => {
    sqlite
      .prepare(
        `INSERT INTO armada_bookings (
          id, armada_ref, status, staff_name, source, booking_type, customer_name, travel_company,
          customer_phone, customer_email, customer_country, group_size, notes, service_type, origin_code,
          destination_code, vehicle_type, vendor_name, vendor_pic, input_currency, exchange_rate,
          cost_per_unit, sell_per_unit, unit_count, total_seats, total_cost_sar, total_sell_sar,
          total_cost_idr, total_sell_idr, profit_sar, profit_idr, profit_margin_percent, amount_paid_sar,
          amount_paid_idr, payment_exchange_rate, payment_method, due_date, payment_reference, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          armada_ref=excluded.armada_ref, status=excluded.status, staff_name=excluded.staff_name, source=excluded.source,
          booking_type=excluded.booking_type, customer_name=excluded.customer_name, travel_company=excluded.travel_company,
          customer_phone=excluded.customer_phone, customer_email=excluded.customer_email, customer_country=excluded.customer_country,
          group_size=excluded.group_size, notes=excluded.notes, service_type=excluded.service_type, origin_code=excluded.origin_code,
          destination_code=excluded.destination_code, vehicle_type=excluded.vehicle_type, vendor_name=excluded.vendor_name,
          vendor_pic=excluded.vendor_pic, input_currency=excluded.input_currency, exchange_rate=excluded.exchange_rate,
          cost_per_unit=excluded.cost_per_unit, sell_per_unit=excluded.sell_per_unit, unit_count=excluded.unit_count,
          total_seats=excluded.total_seats, total_cost_sar=excluded.total_cost_sar, total_sell_sar=excluded.total_sell_sar,
          total_cost_idr=excluded.total_cost_idr, total_sell_idr=excluded.total_sell_idr, profit_sar=excluded.profit_sar,
          profit_idr=excluded.profit_idr, profit_margin_percent=excluded.profit_margin_percent,
          amount_paid_sar=excluded.amount_paid_sar, amount_paid_idr=excluded.amount_paid_idr,
          payment_exchange_rate=excluded.payment_exchange_rate, payment_method=excluded.payment_method,
          due_date=excluded.due_date, payment_reference=excluded.payment_reference, updated_at=excluded.updated_at`
      )
      .run(
        computed.id, computed.armadaRef, computed.status, computed.staffName, computed.source || 'manual',
        computed.bookingType, computed.customerName, computed.travelCompany || null, computed.customerPhone || '',
        computed.customerEmail || '', computed.customerCountry || 'Indonesia', computed.groupSize, computed.notes || null,
        computed.serviceType, computed.originCode, computed.destinationCode, computed.vehicleType,
        computed.vendorName || null, computed.vendorPic || null, computed.inputCurrency, computed.exchangeRate,
        computed.costPerUnit, computed.sellPerUnit, computed.unitCount, computed.totalSeats, computed.totalCostSAR,
        computed.totalSellSAR, computed.totalCostIDR, computed.totalSellIDR, computed.profitSAR, computed.profitIDR,
        computed.profitMarginPercent, computed.amountPaidSAR, computed.amountPaidIDR, computed.paymentExchangeRate || null,
        computed.paymentMethod, computed.dueDate || '', computed.paymentReference || null, createdAt, stamp
      );

    sqlite.prepare('DELETE FROM armada_legs WHERE booking_id = ?').run(computed.id);
    sqlite.prepare('DELETE FROM armada_units WHERE booking_id = ?').run(computed.id);
    sqlite.prepare('DELETE FROM armada_extras WHERE booking_id = ?').run(computed.id);
    sqlite.prepare('DELETE FROM armada_payments WHERE booking_id = ?').run(computed.id);

    const legStmt = sqlite.prepare(
      `INSERT INTO armada_legs (id, booking_id, direction, route_label, departure_date, departure_time, arrival_date, arrival_time, duration_minutes, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    );
    computed.legs.forEach((l, i) =>
      legStmt.run(l.id, computed.id, l.direction, l.routeLabel, l.departureDate, l.departureTime, l.arrivalDate, l.arrivalTime, l.durationMinutes, i)
    );
    const unitStmt = sqlite.prepare(
      `INSERT INTO armada_units (id, booking_id, vehicle_type, plate_number, driver_name, driver_phone, capacity, note, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );
    computed.units.forEach((u, i) =>
      unitStmt.run(u.id, computed.id, u.vehicleType, u.plateNumber, u.driverName, u.driverPhone, u.capacity, u.note, i)
    );
    const extraStmt = sqlite.prepare(`INSERT INTO armada_extras (id, booking_id, description, cost, sell, sort_order) VALUES (?,?,?,?,?,?)`);
    computed.extras.forEach((e, i) => extraStmt.run(e.id.startsWith(computed.id) ? e.id : `${computed.id}-${e.id}`, computed.id, e.description, e.cost, e.sell, i));
    const payStmt = sqlite.prepare(
      `INSERT INTO armada_payments (id, booking_id, paid_at, amount_sar, amount_idr, exchange_rate, method, reference, note)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );
    computed.paymentHistory.forEach((p) =>
      payStmt.run(p.id.startsWith(computed.id) ? p.id : `${computed.id}-${p.id}`, computed.id, p.date, p.amountSAR, p.amountIDR, p.exchangeRate, p.method, p.reference || null, p.note || null)
    );
  });
  tx();
  const saved = await getArmadaBooking(computed.id);
  if (!saved) throw new Error('Failed to persist armada booking');
  return saved;
}

export async function deleteArmadaBooking(id: string) {
  sqlite.prepare('DELETE FROM armada_bookings WHERE id = ?').run(id);
}
