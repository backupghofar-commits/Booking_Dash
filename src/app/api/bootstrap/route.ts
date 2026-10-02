import { error, isResponse, json, requirePerm } from '@/lib/api-helpers';
import { sqlite } from '@/lib/db';
import { listHotelBookings } from '@/server/services/hotel';
import { listTrainBookings } from '@/server/services/train';
import { listArmadaBookings } from '@/server/services/armada';
import { DEFAULT_SETTINGS } from '@/data/InitialData';
import type { CompanySettings, Customer, HotelInfo, ProductRecord, VendorRecord } from '@/types/booking';

export async function GET() {
  const user = await requirePerm('bookings.read');
  if (isResponse(user)) return user;

  try {
    const [bookings, train, armada] = await Promise.all([listHotelBookings(), listTrainBookings(), listArmadaBookings()]);
    const settingRow = sqlite.prepare('SELECT payload FROM settings WHERE id = ?').get('company') as { payload: string } | undefined;
    const customers = sqlite.prepare('SELECT * FROM customers ORDER BY updated_at DESC').all() as Array<{
      id: string; booking_type: string; name: string; travel_company: string | null; phone: string;
      email: string | null; passport: string | null; country: string | null; last_booking_ref: string | null; updated_at: string;
    }>;
    const vendors = sqlite.prepare('SELECT * FROM vendors ORDER BY updated_at DESC').all() as Array<{
      id: string; name: string; pic: string; phone: string; email: string; notes: string; active: number; updated_at: string;
    }>;
    const products = sqlite.prepare('SELECT * FROM products ORDER BY updated_at DESC').all() as Array<{
      id: string; name: string; category: string; unit: string; default_cost_sar: number; default_sell_sar: number; active: number; updated_at: string;
    }>;
    const hotels = sqlite.prepare('SELECT * FROM hotels ORDER BY name ASC').all() as Array<{
      id: string; name: string; city: string; star_rating: number; distance_to_haram: string | null;
      contact_person: string | null; contact_phone: string | null; default_cost_sar: number; default_sell_sar: number;
    }>;
    const fx = sqlite.prepare('SELECT * FROM exchange_rates WHERE id = ?').get('sar-idr') as
      | { rate: number; source: string; stale: number; updated_at: string }
      | undefined;

    let settings: CompanySettings = DEFAULT_SETTINGS;
    if (settingRow?.payload) {
      try {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingRow.payload) };
      } catch {
        settings = DEFAULT_SETTINGS;
      }
    }

    const mappedCustomers: Customer[] = customers.map((c) => ({
      id: c.id,
      bookingType: c.booking_type as Customer['bookingType'],
      name: c.name,
      travelCompany: c.travel_company ?? undefined,
      phone: c.phone,
      email: c.email ?? undefined,
      passport: c.passport ?? undefined,
      country: c.country ?? undefined,
      lastBookingRef: c.last_booking_ref ?? undefined,
      updatedAt: c.updated_at,
    }));

    const mappedVendors: VendorRecord[] = vendors.map((v) => ({
      id: v.id,
      name: v.name,
      pic: v.pic,
      phone: v.phone,
      email: v.email,
      notes: v.notes,
      active: Boolean(v.active),
      updatedAt: v.updated_at,
    }));

    const mappedProducts: ProductRecord[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category as ProductRecord['category'],
      unit: p.unit,
      defaultCostSAR: p.default_cost_sar,
      defaultSellSAR: p.default_sell_sar,
      active: Boolean(p.active),
      updatedAt: p.updated_at,
    }));

    const mappedHotels: HotelInfo[] = hotels.map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city as HotelInfo['city'],
      starRating: h.star_rating,
      distanceToHaram: h.distance_to_haram ?? undefined,
      contactPerson: h.contact_person ?? undefined,
      contactPhone: h.contact_phone ?? undefined,
      defaultCostSAR: h.default_cost_sar,
      defaultSellSAR: h.default_sell_sar,
    }));

    return json({
      user,
      settings,
      bookings,
      train,
      armada,
      customers: mappedCustomers,
      vendors: mappedVendors,
      products: mappedProducts,
      hotels: mappedHotels,
      liveRate: {
        rate: fx?.rate ?? settings.defaultExchangeRateSARtoIDR,
        updatedAt: fx?.updated_at ?? new Date().toISOString(),
        source: fx?.source ?? 'Configured fallback',
        stale: fx ? Boolean(fx.stale) : true,
      },
    });
  } catch (err) {
    console.error(err);
    return error('Failed to load workspace', 500);
  }
}
