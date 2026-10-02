import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { listTrainBookings, upsertTrainBooking } from '@/server/services/train';
import type { TrainBooking } from '@/types/train';

export async function GET() {
  const user = await requirePerm('bookings.read');
  if (isResponse(user)) return user;
  return json({ bookings: await listTrainBookings() });
}

export async function POST(req: Request) {
  const user = await requirePerm('bookings.create');
  if (isResponse(user)) return user;
  let body: TrainBooking;
  try {
    body = (await req.json()) as TrainBooking;
  } catch {
    return error('Invalid JSON', 400);
  }
  if (!body?.id || !body.customerName || !body.originCode || !body.destinationCode) {
    return error('Incomplete train booking', 400);
  }
  if (body.originCode === body.destinationCode) return error('Origin and destination must differ', 400);
  try {
    const saved = await upsertTrainBooking(body, user.role === 'ADMIN');
    await writeAudit({
      user,
      action: 'CREATE',
      entity: 'train_booking',
      entityId: saved.id,
      details: { ref: saved.trainRef },
      ip: clientIp(req),
    });
    return json({ booking: saved }, 201);
  } catch (err) {
    return error(err instanceof Error ? err.message : 'Save failed', 400);
  }
}
