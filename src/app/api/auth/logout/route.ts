import { destroySession, getSessionUser } from '@/lib/auth/session';
import { clientIp, json, writeAudit } from '@/lib/api-helpers';

export async function POST(req: Request) {
  const user = await getSessionUser();
  await writeAudit({ user, action: 'LOGOUT', entity: 'auth', ip: clientIp(req) });
  await destroySession();
  return json({ ok: true });
}
