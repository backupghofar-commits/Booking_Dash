export {
  DEFAULT_SAR_TO_IDR,
  formatSAR,
  formatIDR,
  formatCurrency,
  convertSARtoIDR,
  convertIDRtoSAR,
  calculateNights,
  computeBookingTotals,
  getProfitMarginBadge,
} from '@/utils/currency';

export {
  parseMoney,
  parseIDR,
  parseSAR,
  parseDate,
  nightsBetween,
  calculateRoomTotal,
  calculateBookingTotal,
  calculateProfit,
  calculateMargin,
  validateFinancials,
} from '@/utils/finance';

export {
  computeArmadaTotals,
  summarizeArmadaPayments,
  fareForVehicle,
  generateArmadaRef,
  getRouteFare as getArmadaRouteFare,
} from '@/utils/armadaFinance';

export {
  computeTrainTotals,
  summarizeTrainPayments,
  generateTrainRef,
  getRouteFare as getTrainRouteFare,
} from '@/utils/trainFinance';

export { generateInvoiceRef } from '@/utils/invoiceRef';

export {
  roundSAR,
  roundIDR,
  roundPct,
  derivePaymentStatus,
  canTransition,
  assertTransition,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from './workflow';
