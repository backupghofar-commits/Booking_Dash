import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { sqlite, nowIso } from '@/lib/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password';
import { userCreateSchema } from '@/lib/validations/booking';
import { ROLES } from '@/lib/auth/permissions';
import { newId } from '@/lib/ids';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: number;
  last_login_at: string | null;
  created_at: string;
};

function mapUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    active: Boolean(u.active),
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}

export async function GET() {
  const user = await requirePerm('users.read');
  if (isResponse(user)) return user;
  const users = sqlite.prepare('SELECT id, email, name, role, active, last_login_at, created_at FROM users ORDER BY created_at ASC').all() as UserRow[];
  return json({ users: users.map(mapUser) });
}

export async function POST(req: Request) {
  const user = await requirePerm('users.manage');
  if (isResponse(user)) return user;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON', 400);
  }
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) return error(parsed.error.issues[0]?.message || 'Invalid user', 400);
  const strength = validatePasswordStrength(parsed.data.password);
  if (strength) return error(strength, 400);
  const email = parsed.data.email.trim().toLowerCase();
  const exists = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return error('Email already in use', 409);
  const stamp = nowIso();
  const created: UserRow = {
    id: newId('usr-'),
    email,
    name: parsed.data.name,
    role: parsed.data.role,
    active: parsed.data.active === false ? 0 : 1,
    last_login_at: null,
    created_at: stamp,
  };
  sqlite
    .prepare(
      `INSERT INTO users (id, email, name, password_hash, role, active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(created.id, created.email, created.name, await hashPassword(parsed.data.password), created.role, created.active, stamp, stamp);
  await writeAudit({
    user,
    action: 'CREATE',
    entity: 'user',
    entityId: created.id,
    details: { email: created.email, role: created.role },
    ip: clientIp(req),
  });
  return json({ user: mapUser(created) }, 201);
}

export async function PUT(req: Request) {
  const user = await requirePerm('users.manage');
  if (isResponse(user)) return user;
  let body: { id: string; name?: string; role?: string; active?: boolean; password?: string };
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON', 400);
  }
  if (!body.id) return error('User id required', 400);
  if (body.id === user.id && body.active === false) return error('You cannot deactivate yourself', 400);
  if (body.role && !(ROLES as readonly string[]).includes(body.role)) return error('Invalid role', 400);
  if (body.password) {
    const strength = validatePasswordStrength(body.password);
    if (strength) return error(strength, 400);
  }
  const current = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(body.id) as UserRow | undefined;
  if (!current) return error('Not found', 404);
  const stamp = nowIso();
  sqlite
    .prepare('UPDATE users SET name = ?, role = ?, active = ?, password_hash = COALESCE(?, password_hash), updated_at = ? WHERE id = ?')
    .run(
      body.name || current.name,
      body.role || current.role,
      typeof body.active === 'boolean' ? (body.active ? 1 : 0) : current.active,
      body.password ? await hashPassword(body.password) : null,
      stamp,
      body.id
    );
  const updated = sqlite.prepare('SELECT id, email, name, role, active, last_login_at, created_at FROM users WHERE id = ?').get(body.id) as UserRow;
  await writeAudit({
    user,
    action: 'UPDATE',
    entity: 'user',
    entityId: updated.id,
    details: { role: updated.role, active: Boolean(updated.active), passwordReset: Boolean(body.password) },
    ip: clientIp(req),
  });
  return json({ user: mapUser(updated) });
}
