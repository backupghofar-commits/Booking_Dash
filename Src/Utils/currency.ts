import { Currency } from '../types/booking';

export const DEFAULT_SAR_TO_IDR = 4250;

/**
 * Format SAR currency
 */
export function formatSAR(amount: number, showSymbol: boolean = true): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

  return showSymbol ? `SAR ${formatted}` : formatted;
}

/**
 * Format IDR currency
 */
export function formatIDR(amount: number, showSymbol: boolean = true): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

  return showSymbol ? `Rp ${formatted}` : formatted;
}

/**
 * Generic currency formatter depending on type
 */
export function formatCurrency(amount: number, currency: Currency, showSymbol: boolean = true): string {
  return currency === 'SAR' ? formatSAR(amount, showSymbol) : formatIDR(amount, showSymbol);
}

/**
 * Convert SAR to IDR
 */
export function convertSARtoIDR(amountSAR: number, rate: number = DEFAULT_SAR_TO_IDR): number {
  return (amountSAR || 0) * rate;
}

/**
 * Convert IDR to SAR
 */
export function convertIDRtoSAR(amountIDR: number, rate: number = DEFAULT_SAR_TO_IDR): number {
  if (!rate || rate <= 0) return 0;
  return (amountIDR || 0) / rate;
}

/**
 * Calculate nights between checkIn and checkOut date strings (YYYY-MM-DD)
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
}

/**
 * Compute full booking financial metrics given inputs
 */
export function computeBookingTotals(
  rooms: { numberOfRooms: number; costPerNight: number; sellPerNight: number }[],
  additionalServices: { cost: number; sell: number }[],
  totalNights: number,
  inputCurrency: Currency,
  exchangeRate: number,
  amountPaidInput: number,
  paymentRate?: number
) {
  let rawCost = 0;
  let rawSell = 0;

  // Sum room costs & sells
  rooms.forEach((room) => {
    const qty = room.numberOfRooms || 0;
    const costNight = room.costPerNight || 0;
    const sellNight = room.sellPerNight || 0;
    rawCost += qty * costNight * totalNights;
    rawSell += qty * sellNight * totalNights;
  });

  // Sum additional services
  additionalServices.forEach((service) => {
    rawCost += service.cost || 0;
    rawSell += service.sell || 0;
  });

  let totalCostSAR = 0;
  let totalSellSAR = 0;
  let totalCostIDR = 0;
  let totalSellIDR = 0;

  if (inputCurrency === 'SAR') {
    totalCostSAR = rawCost;
    totalSellSAR = rawSell;
    totalCostIDR = convertSARtoIDR(rawCost, exchangeRate);
    totalSellIDR = convertSARtoIDR(rawSell, exchangeRate);
  } else {
    totalCostIDR = rawCost;
    totalSellIDR = rawSell;
    totalCostSAR = convertIDRtoSAR(rawCost, exchangeRate);
    totalSellSAR = convertIDRtoSAR(rawSell, exchangeRate);
  }

  const profitSAR = totalSellSAR - totalCostSAR;
  const profitIDR = totalSellIDR - totalCostIDR;
  const profitMarginPercent = totalSellSAR > 0 ? (profitSAR / totalSellSAR) * 100 : 0;

  let amountPaidSAR = 0;
  let amountPaidIDR = 0;
  const effectivePaymentRate = paymentRate && paymentRate > 0 ? paymentRate : exchangeRate;

  if (inputCurrency === 'SAR') {
    amountPaidSAR = amountPaidInput || 0;
    amountPaidIDR = convertSARtoIDR(amountPaidSAR, effectivePaymentRate);
  } else {
    amountPaidIDR = amountPaidInput || 0;
    amountPaidSAR = convertIDRtoSAR(amountPaidIDR, effectivePaymentRate);
  }

  const remainingBalanceSAR = totalSellSAR - amountPaidSAR;
  const remainingBalanceIDR = totalSellIDR - amountPaidIDR;

  return {
    totalCostSAR,
    totalSellSAR,
    totalCostIDR,
    totalSellIDR,
    profitSAR,
    profitIDR,
    profitMarginPercent,
    amountPaidSAR,
    amountPaidIDR,
    remainingBalanceSAR,
    remainingBalanceIDR,
    paymentRate: effectivePaymentRate,
  };
}

/**
 * Format profit margin health badge color and status
 */
export function getProfitMarginBadge(margin: number) {
  if (margin >= 20) {
    return {
      label: 'High Margin',
      bgClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      textClass: 'text-emerald-700',
    };
  } else if (margin >= 10) {
    return {
      label: 'Healthy Profit',
      bgClass: 'bg-teal-100 text-teal-800 border-teal-300',
      textClass: 'text-teal-700',
    };
  } else if (margin >= 5) {
    return {
      label: 'Low Margin',
      bgClass: 'bg-amber-100 text-amber-800 border-amber-300',
      textClass: 'text-amber-700',
    };
  } else if (margin > 0) {
    return {
      label: 'Minimal Margin',
      bgClass: 'bg-orange-100 text-orange-800 border-orange-300',
      textClass: 'text-orange-700',
    };
  } else {
    return {
      label: 'Loss / Negative',
      bgClass: 'bg-rose-100 text-rose-800 border-rose-300',
      textClass: 'text-rose-700',
    };
  }
}
