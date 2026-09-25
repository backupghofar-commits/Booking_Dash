import type { Currency, PaymentMethod, PaymentStatus } from './booking';

export type TrainStationCode = 'MKK' | 'JED' | 'JED-AIR' | 'KAEC' | 'MDN';

export interface TrainStation {
  code: TrainStationCode;
  name: string;
  shortName: string;
  city: string;
}

export const TRAIN_STATIONS: TrainStation[] = [
  { code: 'MKK', name: 'Makkah Station — Rusayfah', shortName: 'Makkah', city: 'Makkah' },
  { code: 'JED-AIR', name: 'Jeddah Airport Station — KAIA Terminal 1', shortName: 'Jeddah Airport', city: 'Jeddah' },
  { code: 'JED', name: 'Jeddah Central — Al Sulaymaniyah', shortName: 'Jeddah', city: 'Jeddah' },
  { code: 'KAEC', name: 'KAEC Station — Rabigh', shortName: 'KAEC', city: 'Rabigh' },
  { code: 'MDN', name: 'Madinah Station', shortName: 'Madinah', city: 'Madina' },
];

export type TrainClass = 'Economy' | 'Business';
export type TrainTripType = 'One-Way' | 'Round-Trip';
export type PaxCategory = 'Adult' | 'Child' | 'Infant';

export interface TrainPassenger {
  id: string;
  fullName: string;
  idNumber: string;
  nationality: string;
  category: PaxCategory;
  seatCoach: string;
  seatNumber: string;
}

export interface TrainLeg {
  id: string;
  direction: 'Outbound' | 'Return';
  trainNo: string;
  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:mm
  arrivalDate: string;
  arrivalTime: string;
  durationMinutes: number;
}

export interface TrainExtraItem {
  id: string;
  description: string;
  cost: number;
  sell: number;
}

export interface TrainPayment {
  id: string;
  date: string;
  amountSAR: number;
  amountIDR: number;
  exchangeRate: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export interface TrainBooking {
  id: string;
  trainRef: string; // HHR-YYYY-XXXX
  createdAt: string;
  updatedAt: string;
  status: PaymentStatus;
  staffName: string;
  source?: 'manual' | 'import';

  // Customer
  bookingType: 'Private' | 'Group';
  customerName: string;
  travelCompany?: string;
  customerPhone: string;
  customerEmail: string;
  customerCountry: string;
  notes?: string;

  // Journey
  tripType: TrainTripType;
  originCode: TrainStationCode;
  destinationCode: TrainStationCode;
  trainClass: TrainClass;
  legs: TrainLeg[];

  // Vendor
  vendorName?: string;
  vendorPic?: string;

  // Commercials (per-pax, input currency)
  inputCurrency: Currency;
  exchangeRate: number;
  costPerPax: number;
  sellPerPax: number;
  paxCount: number; // derived
  passengers: TrainPassenger[];
  extras: TrainExtraItem[];

  // Totals
  totalCostSAR: number;
  totalSellSAR: number;
  totalCostIDR: number;
  totalSellIDR: number;
  profitSAR: number;
  profitIDR: number;
  profitMarginPercent: number;

  // Payments
  amountPaidSAR: number;
  amountPaidIDR: number;
  paymentExchangeRate?: number;
  paymentMethod: PaymentMethod;
  dueDate: string;
  paymentReference?: string;
  paymentHistory: TrainPayment[];
}

export type { Currency, PaymentMethod, PaymentStatus };
