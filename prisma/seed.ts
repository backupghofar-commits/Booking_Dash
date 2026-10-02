import bcrypt from 'bcryptjs';
import { sqlite, nowIso } from '../src/lib/db';
import { newId } from '../src/lib/ids';
import { DEFAULT_HOTELS, DEFAULT_SETTINGS, INITIAL_BOOKINGS } from '../src/data/InitialData';
import { INITIAL_ARMADA_BOOKINGS } from '../src/data/initialArmadaData';
import { INITIAL_TRAIN_BOOKINGS } from '../src/data/initialTrainData';
import { upsertHotelBooking } from '../src/server/services/hotel';
import { upsertTrainBooking } from '../src/server/services/train';
import { upsertArmadaBooking } from '../src/server/services/armada';

async function main() {
  const password = await bcrypt.hash('Tamima@2026', 12);
  const stamp = nowIso();

  const users = [
    { email: 'admin@tamima.local', name: 'Ghofar (Admin)', role: 'ADMIN' },
    { email: 'manager@tamima.local', name: 'Hafiz Rahmani', role: 'MANAGER' },
    { email: 'staff@tamima.local', name: 'Amina Al-Mansoor', role: 'STAFF' },
    { email: 'finance@tamima.local', name: 'Budi Setiawan', role: 'FINANCE' },
    { email: 'viewer@tamima.local', name: 'Siti Rahmawati', role: 'VIEWER' },
  ];

  for (const u of users) {
    const existing = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(u.email) as { id: string } | undefined;
    if (existing) {
      sqlite
        .prepare('UPDATE users SET name = ?, role = ?, password_hash = ?, active = 1, updated_at = ? WHERE id = ?')
        .run(u.name, u.role, password, stamp, existing.id);
    } else {
      sqlite
        .prepare(
          `INSERT INTO users (id, email, name, password_hash, role, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .run(newId('usr-'), u.email, u.name, password, u.role, stamp, stamp);
    }
  }

  sqlite
    .prepare(
      `INSERT INTO settings (id, payload, updated_at) VALUES ('company', ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`
    )
    .run(JSON.stringify(DEFAULT_SETTINGS), stamp);

  sqlite
    .prepare(
      `INSERT INTO exchange_rates (id, rate, source, stale, updated_at) VALUES ('sar-idr', ?, 'Configured fallback', 1, ?)
       ON CONFLICT(id) DO UPDATE SET rate=excluded.rate, updated_at=excluded.updated_at`
    )
    .run(DEFAULT_SETTINGS.defaultExchangeRateSARtoIDR, stamp);

  const hotelStmt = sqlite.prepare(
    `INSERT INTO hotels (id, name, city, star_rating, distance_to_haram, contact_person, contact_phone, default_cost_sar, default_sell_sar, active, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,1,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, city=excluded.city, star_rating=excluded.star_rating,
       distance_to_haram=excluded.distance_to_haram, contact_person=excluded.contact_person, contact_phone=excluded.contact_phone,
       default_cost_sar=excluded.default_cost_sar, default_sell_sar=excluded.default_sell_sar, updated_at=excluded.updated_at`
  );
  for (const h of DEFAULT_HOTELS) {
    hotelStmt.run(h.id, h.name, h.city, h.starRating, h.distanceToHaram || null, h.contactPerson || null, h.contactPhone || null, h.defaultCostSAR, h.defaultSellSAR, stamp, stamp);
  }

  const custStmt = sqlite.prepare(
    `INSERT INTO customers (id, booking_type, name, travel_company, phone, email, passport, country, last_booking_ref, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, phone=excluded.phone, email=excluded.email, last_booking_ref=excluded.last_booking_ref, updated_at=excluded.updated_at`
  );
  const vendorNames = new Set<string>();
  for (const b of INITIAL_BOOKINGS) {
    if (b.vendorName) vendorNames.add(b.vendorName);
    custStmt.run(`cust-${b.id}`, b.bookingType || 'Private', b.customerName, b.travelCompany || null, b.customerPhone, b.customerEmail, b.customerPassport, b.customerCountry, b.bookingRef, stamp, stamp);
  }

  let vIdx = 1;
  for (const name of vendorNames) {
    const exists = sqlite.prepare('SELECT id FROM vendors WHERE name = ?').get(name);
    if (exists) continue;
    sqlite
      .prepare(
        `INSERT INTO vendors (id, name, pic, phone, email, notes, active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,1,?,?)`
      )
      .run(`vnd-${vIdx++}`, name, '', '', '', 'Seeded from bookings', stamp, stamp);
  }

  sqlite
    .prepare(
      `INSERT OR IGNORE INTO products (id, name, category, unit, default_cost_sar, default_sell_sar, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,1,?,?)`
    )
    .run('prd-1', 'Quad Haram View', 'Room', 'night', 850, 1100, stamp, stamp);
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO products (id, name, category, unit, default_cost_sar, default_sell_sar, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,1,?,?)`
    )
    .run('prd-2', 'Airport Transfer GMC', 'Transport', 'trip', 450, 650, stamp, stamp);
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO products (id, name, category, unit, default_cost_sar, default_sell_sar, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,1,?,?)`
    )
    .run('prd-3', 'Umrah Visa', 'Visa', 'pax', 300, 400, stamp, stamp);

  for (const b of INITIAL_BOOKINGS) {
    const exists = sqlite.prepare('SELECT id FROM hotel_bookings WHERE id = ?').get(b.id);
    if (!exists) await upsertHotelBooking(b, true);
  }
  for (const b of INITIAL_TRAIN_BOOKINGS) {
    const exists = sqlite.prepare('SELECT id FROM train_bookings WHERE id = ?').get(b.id);
    if (!exists) {
      await upsertTrainBooking(
        {
          ...b,
          legs: b.legs.map((l) => ({ ...l, id: `${b.id}-${l.id}` })),
          passengers: b.passengers.map((p) => ({ ...p, id: `${b.id}-${p.id}` })),
          extras: b.extras.map((e) => ({ ...e, id: `${b.id}-${e.id}` })),
        },
        true
      );
    }
  }
  for (const b of INITIAL_ARMADA_BOOKINGS) {
    const exists = sqlite.prepare('SELECT id FROM armada_bookings WHERE id = ?').get(b.id);
    if (!exists) {
      await upsertArmadaBooking(
        {
          ...b,
          legs: b.legs.map((l) => ({ ...l, id: `${b.id}-${l.id}` })),
          units: b.units.map((u) => ({ ...u, id: `${b.id}-${u.id}` })),
          extras: b.extras.map((e) => ({ ...e, id: `${b.id}-${e.id}` })),
        },
        true
      );
    }
  }

  sqlite
    .prepare(
      `INSERT INTO audit_logs (id, user_id, user_email, action, entity, entity_id, details, ip, created_at)
       VALUES (?, NULL, NULL, 'SEED', 'system', NULL, ?, NULL, ?)`
    )
    .run(newId('aud-'), JSON.stringify({ message: 'Initial TAMIMA demo dataset loaded' }), stamp);

  console.log('Seed complete. Demo login: admin@tamima.local / Tamima@2026');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
