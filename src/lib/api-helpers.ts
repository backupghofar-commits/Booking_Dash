import { NextResponse } from 'next/server';
import { getSessionUser } from './auth/session';
import { hasPermission, type Permission } from './auth/permissions';
import type { AuthUser } from './auth/session';
import { sqlite, nowIso } from './db';
import { newId } from './ids';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser(): Promise<AuthUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return error('Unauthorized', 401);
  return user;
}

export function isResponse(value: AuthUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requirePerm(permission: Permission): Promise<AuthUser | NextResponse> {
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (!hasPermission(user.role, permission)) return error('Forbidden', 403);
  return user;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

export async function writeAudit(opts: {
  user?: AuthUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
  ip?: string | null;
}) {
  try {
    sqlite
      .prepare(
        `INSERT INTO audit_logs (id, user_id, user_email, action, entity, entity_id, details, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newId('aud-'),
        opts.user?.id ?? null,
        opts.user?.email ?? null,
        opts.action,
        opts.entity,
        opts.entityId ?? null,
        opts.details ? JSON.stringify(opts.details) : null,
        opts.ip ?? null,
        nowIso()
      );
  } catch (err) {
    console.error('audit write failed', err);
  }
}
