import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { listArmadaBookings, upsertArmadaBooking } from '@/server/services/armada';
import type { ArmadaBooking } from '@/types/armada';

export async function GET() {
  const user = await requirePerm('bookings.read');
  if (isResponse(user)) return user;
  return json({ bookings: await listArmadaBookings() });
}

export async function POST(req: Request) {
  const user = await requirePerm('bookings.create');
  if (isResponse(user)) return user;
  let body: ArmadaBooking;
  try {
    body = (await req.json()) as ArmadaBooking;
  } catch {
    return error('Invalid JSON', 400);
  }
  if (!body?.id || !body.customerName || !body.originCode || !body.destinationCode) {
    return error('Incomplete armada booking', 400);
  }
  if (body.originCode === body.destinationCode) return error('Origin and destination must differ', 400);
  try {
    const saved = await upsertArmadaBooking(body, user.role === 'ADMIN');
    await writeAudit({
      user,
      action: 'CREATE',
      entity: 'armada_booking',
      entityId: saved.id,
      details: { ref: saved.armadaRef },
      ip: clientIp(req),
    });
    return json({ booking: saved }, 201);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Save failed', 400);
  }
}
