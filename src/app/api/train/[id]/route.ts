import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { deleteTrainBooking, getTrainBooking, upsertTrainBooking } from '@/server/services/train';
import type { TrainBooking } from '@/types/train';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requirePerm('bookings.read');
  if (isResponse(user)) return user;
  const { id } = await ctx.params;
  const booking = await getTrainBooking(id);
  if (!booking) return error('Not found', 404);
  return json({ booking });
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await requirePerm('bookings.update');
  if (isResponse(user)) return user;
  const { id } = await ctx.params;
  let body: TrainBooking;
  try {
    body = (await req.json()) as TrainBooking;
  } catch {
    return error('Invalid JSON', 400);
  }
  try {
    const saved = await upsertTrainBooking({ ...body, id }, user.role === 'ADMIN');
    await writeAudit({
      user,
      action: 'UPDATE',
      entity: 'train_booking',
      entityId: saved.id,
      details: { ref: saved.trainRef, status: saved.status },
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
  const existing = await getTrainBooking(id);
  if (!existing) return error('Not found', 404);
  await deleteTrainBooking(id);
  await writeAudit({
    user,
    action: 'DELETE',
    entity: 'train_booking',
    entityId: id,
    details: { ref: existing.trainRef },
    ip: clientIp(req),
  });
  return json({ ok: true });
}
