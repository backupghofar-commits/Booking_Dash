import { sqlite, nowIso } from '@/lib/db';
import { loginSchema } from '@/lib/validations/booking';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rate-limit';
import { clientIp, error, json, writeAudit } from '@/lib/api-helpers';

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`login:${ip}`, 8, 15 * 60 * 1000);
  if (!limited.ok) {
    return error(`Too many login attempts. Retry in ${limited.retryAfter}s`, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON', 400);
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return error('Email and password are required', 400);

  const email = parsed.data.email.trim().toLowerCase();
  const user = sqlite
    .prepare('SELECT id, email, name, role, active, password_hash FROM users WHERE email = ?')
    .get(email) as
    | { id: string; email: string; name: string; role: string; active: number; password_hash: string }
    | undefined;
  if (!user || !user.active) {
    await writeAudit({ action: 'LOGIN_FAILED', entity: 'auth', details: { email }, ip });
    return error('Invalid email or password', 401);
  }
  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) {
    await writeAudit({ action: 'LOGIN_FAILED', entity: 'auth', details: { email }, ip });
    return error('Invalid email or password', 401);
  }

  sqlite.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), user.id);
  await createSession(user.id, ip, req.headers.get('user-agent') || undefined);
  const authUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  await writeAudit({ user: authUser as never, action: 'LOGIN', entity: 'auth', ip });
  return json({ user: authUser });
}
