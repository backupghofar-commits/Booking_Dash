import type { ArmadaBooking, ArmadaPayment } from '../types/armada';

/**
 * Umroh Fleet (Armada) REST API client.
 * Contract (PostgreSQL backend):
 *   GET    /api/armada-bookings?from=&to=&origin=&destination=&status=&q=
 *   GET    /api/armada-bookings/:id
 *   POST   /api/armada-bookings
 *   PUT    /api/armada-bookings/:id
 *   DELETE /api/armada-bookings/:id
 *   GET    /api/armada-bookings/:id/payments
 *   POST   /api/armada-bookings/:id/payments
 *   GET    /api/armada-locations
 *
 * Offline-first: falls back to localStorage when API is unreachable.
 */

const API_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ARMADA_API_BASE || '';
const LOCAL_KEY = 'tamima_armada_bookings_v1';

export function apiAvailable(): boolean {
  return Boolean(API_BASE) && navigator.onLine;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`Armada API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const armadaApi = {
  async list(params: Record<string, string> = {}): Promise<ArmadaBooking[]> {
    if (!apiAvailable()) return readLocal();
    const qs = new URLSearchParams(params).toString();
    try {
      const data = await request<ArmadaBooking[]>(`/api/armada-bookings${qs ? `?${qs}` : ''}`);
      writeLocal(data);
      return data;
    } catch {
      return readLocal();
    }
  },
  async get(id: string): Promise<ArmadaBooking | null> {
    if (!apiAvailable()) return readLocal().find((b) => b.id === id) ?? null;
    try {
      return await request<ArmadaBooking>(`/api/armada-bookings/${id}`);
    } catch {
      return readLocal().find((b) => b.id === id) ?? null;
    }
  },
  async create(b: ArmadaBooking): Promise<ArmadaBooking> {
    if (!apiAvailable()) {
      const all = [b, ...readLocal()];
      writeLocal(all);
      return b;
    }
    try {
      return await request<ArmadaBooking>('/api/armada-bookings', { method: 'POST', body: JSON.stringify(b) });
    } catch {
      const all = [b, ...readLocal()];
      writeLocal(all);
      return b;
    }
  },
  async update(b: ArmadaBooking): Promise<ArmadaBooking> {
    if (!apiAvailable()) {
      writeLocal(readLocal().map((x) => (x.id === b.id ? b : x)));
      return b;
    }
    try {
      return await request<ArmadaBooking>(`/api/armada-bookings/${b.id}`, { method: 'PUT', body: JSON.stringify(b) });
    } catch {
      writeLocal(readLocal().map((x) => (x.id === b.id ? b : x)));
      return b;
    }
  },
  async remove(id: string): Promise<void> {
    if (apiAvailable()) {
      try {
        await request(`/api/armada-bookings/${id}`, { method: 'DELETE' });
      } catch {
        /* fall through to local delete */
      }
    }
    writeLocal(readLocal().filter((b) => b.id !== id));
  },
  async addPayment(bookingId: string, payment: ArmadaPayment): Promise<ArmadaPayment> {
    if (apiAvailable()) {
      try {
        return await request<ArmadaPayment>(`/api/armada-bookings/${bookingId}/payments`, {
          method: 'POST',
          body: JSON.stringify(payment),
        });
      } catch {
        /* fall through to local */
      }
    }
    const all = readLocal().map((b) =>
      b.id === bookingId ? { ...b, paymentHistory: [...(b.paymentHistory || []), payment] } : b
    );
    writeLocal(all);
    return payment;
  },
};

export function readLocal(): ArmadaBooking[] {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    return saved ? (JSON.parse(saved) as ArmadaBooking[]) : [];
  } catch {
    return [];
  }
}

export function writeLocal(bookings: ArmadaBooking[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(bookings));
  } catch {
    /* quota full — caller shows toast */
  }
}

export const ARMADA_LOCAL_KEY = LOCAL_KEY;
