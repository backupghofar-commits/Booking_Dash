import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { listHotelBookings, upsertHotelBooking } from '@/server/services/hotel';
import { hotelBookingSchema } from '@/lib/validations/booking';
import type { Booking } from '@/types/booking';

export async function GET() {
  const user = await requirePerm('bookings.read');
  if (isResponse(user)) return user;
  return json({ bookings: await listHotelBookings() });
}

export async function POST(req: Request) {
  const user = await requirePerm('bookings.create');
  if (isResponse(user)) return user;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON', 400);
  }
  const parsed = hotelBookingSchema.safeParse(body);
  if (!parsed.success) return error(parsed.error.issues[0]?.message || 'Invalid booking', 400);
  try {
    const saved = await upsertHotelBooking(parsed.data as Booking, user.role === 'ADMIN');
    await writeAudit({
      user,
      action: 'CREATE',
      entity: 'hotel_booking',
      entityId: saved.id,
      details: { ref: saved.bookingRef },
      ip: clientIp(req),
    });
    return json({ booking: saved }, 201);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Save failed', 400);
  }
}
