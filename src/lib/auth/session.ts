import { cookies } from 'next/headers';
import { sqlite, nowIso } from '../db';
import type { Role } from './permissions';
import { randomBytes } from 'crypto';
import { SESSION_COOKIE } from './constants';
import { newId } from '../ids';

export { SESSION_COOKIE };
const SESSION_DAYS = 7;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

function cookieSecure() {
  return process.env.NODE_ENV === 'production';
}

export function newSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(userId: string, ip?: string, userAgent?: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  sqlite
    .prepare(
      `INSERT INTO sessions (id, token, user_id, expires_at, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(newId('ses-'), token, userId, expiresAt, ip || null, userAgent || null, nowIso());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    expires: new Date(expiresAt),
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  jar.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: cookieSecure(), path: '/', maxAge: 0 });
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: number;
  expires_at: string;
};

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = sqlite
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.active, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as UserRow | undefined;
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  if (!row.active) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role as Role };
}

export async function getTokenFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getSessionUserFromRequest(req: Request): Promise<AuthUser | null> {
  const token = await getTokenFromRequest(req);
  if (!token) return null;
  const row = sqlite
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.active, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as UserRow | undefined;
  if (!row || new Date(row.expires_at) < new Date() || !row.active) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role as Role };
}
