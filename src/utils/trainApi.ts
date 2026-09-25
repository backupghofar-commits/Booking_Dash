import type { TrainBooking, TrainPayment } from '../types/train';

/**
 * Haramain Train REST API client.
 * Contract (PostgreSQL backend):
 *   GET    /api/train-bookings?from=&to=&origin=&destination=&status=&q=
 *   GET    /api/train-bookings/:id
 *   POST   /api/train-bookings
 *   PUT    /api/train-bookings/:id
 *   DELETE /api/train-bookings/:id
 *   GET    /api/train-bookings/:id/payments
 *   POST   /api/train-bookings/:id/payments
 *   GET    /api/train-stations
 *
 * Offline-first: falls back to localStorage when API is unreachable.
 */

const API_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TRAIN_API_BASE || '';
const LOCAL_KEY = 'tamima_train_bookings_v1';

export function apiAvailable(): boolean {
  return Boolean(API_BASE) && navigator.onLine;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`Train API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const trainApi = {
  async list(params: Record<string, string> = {}): Promise<TrainBooking[]> {
    if (!apiAvailable()) return readLocal();
    const qs = new URLSearchParams(params).toString();
    try {
      const data = await request<TrainBooking[]>(`/api/train-bookings${qs ? `?${qs}` : ''}`);
      writeLocal(data);
      return data;
    } catch {
      return readLocal();
    }
  },
  async get(id: string): Promise<TrainBooking | null> {
    if (!apiAvailable()) return readLocal().find((b) => b.id === id) ?? null;
    try {
      return await request<TrainBooking>(`/api/train-bookings/${id}`);
    } catch {
      return readLocal().find((b) => b.id === id) ?? null;
    }
  },
  async create(b: TrainBooking): Promise<TrainBooking> {
    if (!apiAvailable()) {
      const all = [b, ...readLocal()];
      writeLocal(all);
      return b;
    }
    try {
      return await request<TrainBooking>('/api/train-bookings', { method: 'POST', body: JSON.stringify(b) });
    } catch {
      const all = [b, ...readLocal()];
      writeLocal(all);
      return b;
    }
  },
  async update(b: TrainBooking): Promise<TrainBooking> {
    if (!apiAvailable()) {
      writeLocal(readLocal().map((x) => (x.id === b.id ? b : x)));
      return b;
    }
    try {
      return await request<TrainBooking>(`/api/train-bookings/${b.id}`, { method: 'PUT', body: JSON.stringify(b) });
    } catch {
      writeLocal(readLocal().map((x) => (x.id === b.id ? b : x)));
      return b;
    }
  },
  async remove(id: string): Promise<void> {
    if (apiAvailable()) {
      try {
        await request(`/api/train-bookings/${id}`, { method: 'DELETE' });
      } catch {
        /* fall through to local delete */
      }
    }
    writeLocal(readLocal().filter((b) => b.id !== id));
  },
  async addPayment(bookingId: string, payment: TrainPayment): Promise<TrainPayment> {
    if (apiAvailable()) {
      try {
        return await request<TrainPayment>(`/api/train-bookings/${bookingId}/payments`, {
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

export function readLocal(): TrainBooking[] {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    return saved ? (JSON.parse(saved) as TrainBooking[]) : [];
  } catch {
    return [];
  }
}

export function writeLocal(bookings: TrainBooking[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(bookings));
  } catch {
    /* quota full — caller shows toast */
  }
}

export const TRAIN_LOCAL_KEY = LOCAL_KEY;
