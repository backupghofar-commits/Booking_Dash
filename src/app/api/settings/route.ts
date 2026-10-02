import { clientIp, error, isResponse, json, requirePerm, writeAudit } from '@/lib/api-helpers';
import { sqlite, nowIso } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/data/InitialData';
import type { CompanySettings } from '@/types/booking';

export async function GET() {
  const user = await requirePerm('settings.read');
  if (isResponse(user)) return user;
  const row = sqlite.prepare('SELECT payload FROM settings WHERE id = ?').get('company') as { payload: string } | undefined;
  const settings: CompanySettings = row?.payload ? { ...DEFAULT_SETTINGS, ...JSON.parse(row.payload) } : DEFAULT_SETTINGS;
  return json({ settings });
}

export async function PUT(req: Request) {
  const user = await requirePerm('settings.update');
  if (isResponse(user)) return user;
  let body: CompanySettings;
  try {
    body = (await req.json()) as CompanySettings;
  } catch {
    return error('Invalid JSON', 400);
  }
  if (!body?.companyName) return error('Company name is required', 400);
  if (typeof body.defaultExchangeRateSARtoIDR !== 'number' || body.defaultExchangeRateSARtoIDR <= 0) {
    return error('Exchange rate must be a positive number', 400);
  }
  const merged = { ...DEFAULT_SETTINGS, ...body };
  const stamp = nowIso();
  sqlite
    .prepare(
      `INSERT INTO settings (id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`
    )
    .run('company', JSON.stringify(merged), stamp);
  sqlite
    .prepare(
      `INSERT INTO exchange_rates (id, rate, source, stale, updated_at) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(id) DO UPDATE SET rate=excluded.rate, source=excluded.source, stale=0, updated_at=excluded.updated_at`
    )
    .run('sar-idr', merged.defaultExchangeRateSARtoIDR, 'Company settings', stamp);
  await writeAudit({ user, action: 'UPDATE', entity: 'settings', entityId: 'company', ip: clientIp(req) });
  return json({ settings: merged });
}
