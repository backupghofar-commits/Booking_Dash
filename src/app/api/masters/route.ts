import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { sqlite, nowIso } from '@/lib/db';
import type { Customer, ProductRecord, VendorRecord } from '@/types/booking';

export async function PUT(req: Request) {
  const user = await requirePerm('masters.manage');
  if (isResponse(user)) return user;
  let body: { customers?: Customer[]; vendors?: VendorRecord[]; products?: ProductRecord[] };
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON', 400);
  }

  const stamp = nowIso();
  const tx = sqlite.transaction(() => {
    if (body.customers) {
      sqlite.prepare('DELETE FROM customers').run();
      const stmt = sqlite.prepare(
        `INSERT INTO customers (id, booking_type, name, travel_company, phone, email, passport, country, last_booking_ref, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      );
      body.customers.forEach((c) =>
        stmt.run(c.id, c.bookingType, c.name, c.travelCompany || null, c.phone || '', c.email || null, c.passport || null, c.country || null, c.lastBookingRef || null, stamp, stamp)
      );
    }
    if (body.vendors) {
      sqlite.prepare('DELETE FROM vendors').run();
      const stmt = sqlite.prepare(
        `INSERT INTO vendors (id, name, pic, phone, email, notes, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`
      );
      body.vendors.forEach((v) => stmt.run(v.id, v.name, v.pic || '', v.phone || '', v.email || '', v.notes || '', v.active ? 1 : 0, stamp, stamp));
    }
    if (body.products) {
      sqlite.prepare('DELETE FROM products').run();
      const stmt = sqlite.prepare(
        `INSERT INTO products (id, name, category, unit, default_cost_sar, default_sell_sar, active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      );
      body.products.forEach((p) =>
        stmt.run(p.id, p.name, p.category, p.unit, p.defaultCostSAR, p.defaultSellSAR, p.active ? 1 : 0, stamp, stamp)
      );
    }
  });
  tx();

  await writeAudit({
    user,
    action: 'UPDATE',
    entity: 'masters',
    details: { customers: body.customers?.length, vendors: body.vendors?.length, products: body.products?.length },
    ip: clientIp(req),
  });
  return json({ ok: true });
}
