import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { upsertHotelBooking } from '@/server/services/hotel';
import { hotelBookingSchema } from '@/lib/validations/booking';
import type { Booking } from '@/types/booking';

export async function POST(req: Request) {
  const user = await requirePerm('bookings.create');
  if (isResponse(user)) return user;
  let body: { bookings?: Booking[] };
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON', 400);
  }
  const incoming = Array.isArray(body.bookings) ? body.bookings : [];
  let committed = 0;
  let rejected = 0;
  const errors: string[] = [];
  for (const raw of incoming) {
    const parsed = hotelBookingSchema.safeParse(raw);
    if (!parsed.success) {
      rejected += 1;
      errors.push(parsed.error.issues[0]?.message || 'Invalid row');
      continue;
    }
    try {
      await upsertHotelBooking(parsed.data as Booking, user.role === 'ADMIN');
      committed += 1;
    } catch (err) {
      rejected += 1;
      errors.push(err instanceof Error ? err.message : 'Save failed');
    }
  }
  await writeAudit({
    user,
    action: 'IMPORT',
    entity: 'hotel_booking',
    details: { committed, rejected },
    ip: clientIp(req),
  });
  return json({ committed, rejected, errors: errors.slice(0, 20) });
}
