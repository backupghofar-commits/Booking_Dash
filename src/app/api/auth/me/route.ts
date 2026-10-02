import { getSessionUser } from '@/lib/auth/session';
import { error, json } from '@/lib/api-helpers';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return error('Unauthorized', 401);
  return json({ user });
}
