import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { deleteArmadaBooking, getArmadaBooking, upsertArmadaBooking } from '@/server/services/armada';
import type { ArmadaBooking } from '@/types/armada';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requirePerm('bookings.read');
  if (isResponse(user)) return user;
  const { id } = await ctx.params;
  const booking = await getArmadaBooking(id);
  if (!booking) return error('Not found', 404);
  return json({ booking });
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await requirePerm('bookings.update');
  if (isResponse(user)) return user;
  const { id } = await ctx.params;
  let body: ArmadaBooking;
  try {
    body = (await req.json()) as ArmadaBooking;
  } catch {
    return error('Invalid JSON', 400);
  }
  try {
    const saved = await upsertArmadaBooking({ ...body, id }, user.role === 'ADMIN');
    await writeAudit({
      user,
      action: 'UPDATE',
      entity: 'armada_booking',
      entityId: saved.id,
      details: { ref: saved.armadaRef, status: saved.status },
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
  const existing = await getArmadaBooking(id);
  if (!existing) return error('Not found', 404);
  await deleteArmadaBooking(id);
  await writeAudit({
    user,
    action: 'DELETE',
    entity: 'armada_booking',
    entityId: id,
    details: { ref: existing.armadaRef },
    ip: clientIp(req),
  });
  return json({ ok: true });
}
