import { isResponse, json, requirePerm } from '@/lib/api-helpers';
import { sqlite } from '@/lib/db';

export async function GET(req: Request) {
  const user = await requirePerm('audit.read');
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim().toLowerCase() || '';
  const action = url.searchParams.get('action') || '';
  const entity = url.searchParams.get('entity') || '';
  const take = Math.min(200, Number(url.searchParams.get('take') || 80));

  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: unknown[] = [];
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }
  if (entity) {
    sql += ' AND entity = ?';
    params.push(entity);
  }
  if (q) {
    sql += ' AND (lower(ifnull(user_email,\'\')) LIKE ? OR lower(action) LIKE ? OR lower(entity) LIKE ? OR lower(ifnull(entity_id,\'\')) LIKE ? OR lower(ifnull(details,\'\')) LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(take);
  const logs = sqlite.prepare(sql).all(...params);
  return json({ logs });
}
