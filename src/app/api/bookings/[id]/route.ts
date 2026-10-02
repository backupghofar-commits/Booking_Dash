import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { deleteHotelBooking, getHotelBooking, upsertHotelBooking } from '@/server/services/hotel';
import { hotelBookingSchema } from '@/lib/validations/booking';
import type { Booking } from '@/types/booking';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requirePerm('bookings.read');
  if (isResponse(user)) return user;
  const { id } = await ctx.params;
  const booking = await getHotelBooking(id);
  if (!booking) return error('Not found', 404);
  return json({ booking });
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await requirePerm('bookings.update');
  if (isResponse(user)) return user;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON', 400);
  }
  const parsed = hotelBookingSchema.safeParse({ ...(body as object), id });
  if (!parsed.success) return error(parsed.error.issues[0]?.message || 'Invalid booking', 400);
  try {
    const saved = await upsertHotelBooking(parsed.data as Booking, user.role === 'ADMIN');
    await writeAudit({
      user,
      action: 'UPDATE',
      entity: 'hotel_booking',
      entityId: saved.id,
      details: { ref: saved.bookingRef, status: saved.status },
      ip: clientIp(req),
    });
    return json({ booking: saved });
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Save failed', 400);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const user = await requirePerm('bookings.delete');
  if (isResponse(user)) return user;
  const { id } = await ctx.params;
  const existing = await getHotelBooking(id);
  if (!existing) return error('Not found', 404);
  await deleteHotelBooking(id);
  await writeAudit({
    user,
    action: 'DELETE',
    entity: 'hotel_booking',
    entityId: id,
    details: { ref: existing.bookingRef },
    ip: clientIp(req),
  });
  return json({ ok: true });
}
