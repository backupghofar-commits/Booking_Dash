export type PaymentStatus = 'Draft' | 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled';

export const PAYMENT_STATUSES: PaymentStatus[] = ['Draft', 'Unpaid', 'Partial', 'Paid', 'Cancelled'];

const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  Draft: ['Unpaid', 'Cancelled'],
  Unpaid: ['Partial', 'Paid', 'Draft', 'Cancelled'],
  Partial: ['Paid', 'Unpaid', 'Cancelled'],
  Paid: ['Partial', 'Cancelled'],
  Cancelled: ['Draft'],
};

export function roundSAR(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function roundIDR(n: number): number {
  return Math.round(Number(n) || 0);
}

export function roundPct(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function derivePaymentStatus(
  current: PaymentStatus,
  paidSAR: number,
  totalSellSAR: number
): PaymentStatus {
  if (current === 'Draft' || current === 'Cancelled') return current;
  if (paidSAR <= 0.5) return 'Unpaid';
  if (totalSellSAR - paidSAR <= 0.5) return 'Paid';
  return 'Partial';
}

export function canTransition(from: PaymentStatus, to: PaymentStatus, isAdmin = false): boolean {
  if (from === to) return true;
  if (isAdmin) return true;
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus, isAdmin = false) {
  if (!canTransition(from, to, isAdmin)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`);
  }
}
