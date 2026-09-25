import { PaymentRecord } from '../types/booking';
import { parseIDR } from './finance';

const CACHE_KEY = 'tamima_mandiri_sar_banknotes_sell';
const CACHE_MAX_AGE = 6 * 60 * 60 * 1000;

export interface LiveExchangeRate {
  rate: number;
  updatedAt: string;
  source: 'Bank Mandiri Bank Notes Jual' | 'Cached Bank Mandiri' | 'Configured fallback';
  stale: boolean;
}

/** Weighted average based on actual invoice payment history. */
export function averageTransactionRate(
  history: PaymentRecord[] | undefined,
  fallbackRate: number
): number {
  const records = (history || []).filter(
    (payment) => payment.amountSAR > 0 && payment.amountIDR > 0
  );
  if (records.length === 0) return fallbackRate;
  const totalSAR = records.reduce((sum, payment) => sum + payment.amountSAR, 0);
  const totalIDR = records.reduce((sum, payment) => sum + payment.amountIDR, 0);
  return totalSAR > 0 ? Math.round((totalIDR / totalSAR) * 100) / 100 : fallbackRate;
}

function readCache(): LiveExchangeRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as LiveExchangeRate;
    if (!Number.isFinite(cached.rate) || cached.rate <= 0) return null;
    return {
      ...cached,
      source: 'Cached Bank Mandiri',
      stale: Date.now() - new Date(cached.updatedAt).getTime() > CACHE_MAX_AGE,
    };
  } catch {
    return null;
  }
}

function parseMandiriHtml(html: string): { rate: number; updatedAt: string } | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table tr'));
  const sar = rows.find((row) => row.querySelector('td')?.textContent?.trim() === 'SAR');
  if (!sar) return null;
  const cells = Array.from(sar.querySelectorAll('td')).map((cell) => cell.textContent?.trim() || '');
  // Currency + Special buy/sell + TT buy/sell + Bank Notes buy/sell.
  const bankNotesSell = parseIDR(cells[6]);
  if (bankNotesSell == null || bankNotesSell <= 0) return null;
  const tableText = sar.closest('table')?.querySelector('thead')?.textContent || '';
  const timestamp = tableText.match(/Bank Notes\s*(\d{2}\/\d{2}\/\d{2}\s*-\s*\d{2}:\d{2}\s*WIB)/i)?.[1];
  return {
    rate: bankNotesSell,
    updatedAt: timestamp ? `${timestamp} (Bank Mandiri)` : new Date().toISOString(),
  };
}

/**
 * Best-effort online synchronization. Bank Mandiri may restrict browser CORS;
 * in that case the last verified cache is returned, never a guessed value.
 */
export async function fetchMandiriSarBankNotesSell(
  fallbackRate: number,
  force = false
): Promise<LiveExchangeRate> {
  const cached = readCache();
  if (!force && cached && !cached.stale) return cached;
  if (!navigator.onLine) {
    return cached || {
      rate: fallbackRate,
      updatedAt: new Date().toISOString(),
      source: 'Configured fallback',
      stale: true,
    };
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    const response = await fetch('https://www.bankmandiri.co.id/kurs', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'text/html' },
    });
    window.clearTimeout(timer);
    if (!response.ok) throw new Error(`Bank Mandiri HTTP ${response.status}`);
    const parsed = parseMandiriHtml(await response.text());
    if (!parsed) throw new Error('SAR Bank Notes Jual row not found');
    const live: LiveExchangeRate = {
      ...parsed,
      source: 'Bank Mandiri Bank Notes Jual',
      stale: false,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(live));
    return live;
  } catch {
    return cached || {
      rate: fallbackRate,
      updatedAt: new Date().toISOString(),
      source: 'Configured fallback',
      stale: true,
    };
  }
}