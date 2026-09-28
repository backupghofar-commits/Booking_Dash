import type { Currency, PaymentMethod, PaymentStatus } from './booking';

// Ground-transport points used for Umroh fleet (armada) transfers & charters.
export type ArmadaLocationCode = 'JED-AIR' | 'MKK' | 'MDN' | 'MED-AIR' | 'JED' | 'TAIF';

export interface ArmadaLocation {
  code: ArmadaLocationCode;
  name: string;
  shortName: string;
  city: string;
}

export const ARMADA_LOCATIONS: ArmadaLocation[] = [
  { code: 'JED-AIR', name: 'Jeddah — King Abdulaziz Intl Airport (JED)', shortName: 'Jeddah Airport', city: 'Jeddah' },
  { code: 'MKK', name: 'Makkah — Hotel Area (Masjidil Haram)', shortName: 'Makkah', city: 'Makkah' },
  { code: 'MDN', name: 'Madinah — Hotel Area (Masjid Nabawi)', shortName: 'Madinah', city: 'Madina' },
  { code: 'MED-AIR', name: 'Madinah — Prince Mohammad Bin Abdulaziz Airport (MED)', shortName: 'Madinah Airport', city: 'Madina' },
  { code: 'JED', name: 'Jeddah — City / Corniche', shortName: 'Jeddah City', city: 'Jeddah' },
  { code: 'TAIF', name: 'Taif — Al Hada / City', shortName: 'Taif', city: 'Taif' },
];

// Fleet vehicle categories commonly used for Umroh ground transport.
export type VehicleType =
  | 'Bus 50 Seat'
  | 'Bus 45 Seat'
  | 'Coaster 23 Seat'
  | 'Hiace 13 Seat'
  | 'GMC 7 Seat'
  | 'Sedan 4 Seat';

export const VEHICLE_TYPES: VehicleType[] = [
  'Bus 50 Seat',
  'Bus 45 Seat',
  'Coaster 23 Seat',
  'Hiace 13 Seat',
  'GMC 7 Seat',
  'Sedan 4 Seat',
];

export const VEHICLE_CAPACITY: Record<VehicleType, number> = {
  'Bus 50 Seat': 50,
  'Bus 45 Seat': 45,
  'Coaster 23 Seat': 23,
  'Hiace 13 Seat': 13,
  'GMC 7 Seat': 7,
  'Sedan 4 Seat': 4,
};

// One-Way transfer vs. Round-Trip (there & back) — drives leg count, mirrors train trip type.
export type ServiceType = 'One-Way' | 'Round-Trip';

// A physical vehicle assigned to the charter (one row = one unit + driver).
export interface ArmadaUnit {
  id: string;
  vehicleType: VehicleType;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  note: string;
}

export interface ArmadaLeg {
  id: string;
  direction: 'Outbound' | 'Return';
  routeLabel: string;
  departureDate: string; // YYYY-MM-DD
  departureTime: string; // HH:mm
  arrivalDate: string;
  arrivalTime: string;
  durationMinutes: number;
}

export interface ArmadaExtraItem {
  id: string;
  description: string;
  cost: number;
  sell: number;
}

export interface ArmadaPayment {
  id: string;
  date: string;
  amountSAR: number;
  amountIDR: number;
  exchangeRate: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export interface ArmadaBooking {
  id: string;
  armadaRef: string; // AMD-YYYY-XXXX
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
  groupSize: number; // number of jamaah being transported
  notes?: string;

  // Journey
  serviceType: ServiceType;
  originCode: ArmadaLocationCode;
  destinationCode: ArmadaLocationCode;
  vehicleType: VehicleType; // primary vehicle class for the charter
  legs: ArmadaLeg[];

  // Vendor (transport supplier)
  vendorName?: string;
  vendorPic?: string;

  // Commercials (per-unit, input currency)
  inputCurrency: Currency;
  exchangeRate: number;
  costPerUnit: number;
  sellPerUnit: number;
  unitCount: number; // derived (number of vehicles)
  totalSeats: number; // derived (sum of unit capacities)
  units: ArmadaUnit[];
  extras: ArmadaExtraItem[];

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
  paymentHistory: ArmadaPayment[];
}

export type { Currency, PaymentMethod, PaymentStatus };
