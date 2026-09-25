export type Currency = 'SAR' | 'IDR';

export type PaymentStatus = 'Draft' | 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled';

export type PaymentMethod = 'Bank Transfer (Al Rajhi)' | 'Bank Transfer (BCA/Mandiri)' | 'Credit Card' | 'Cash' | 'Credit/Invoice';

export interface RoomDetail {
  id: string;
  roomType: string;
  numberOfRooms: number;
  costPerNight: number;
  sellPerNight: number;
  mealPlan: 'Room Only' | 'Breakfast' | 'Half Board' | 'Full Board';
}

export interface AdditionalCostItem {
  id: string;
  description: string;
  cost: number;
  sell: number;
}

export type BookingType = 'Private' | 'Group';
export type VisaAction = 'Agreement Sent' | 'Approved' | 'Rejected' | 'BRN';
export type PaymentDirection = 'customer' | 'vendor';

export interface PaymentRecord {
  id: string;
  date: string;
  amountSAR: number;
  amountIDR: number;
  exchangeRate?: number;
  direction?: PaymentDirection;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export interface Customer {
  id: string;
  bookingType: BookingType;
  name: string;
  travelCompany?: string;
  phone: string;
  email?: string;
  passport?: string;
  country?: string;
  lastBookingRef?: string;
  updatedAt: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  pic: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
  updatedAt: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  category: 'Room' | 'Service' | 'Transport' | 'Visa' | 'Other';
  unit: string;
  defaultCostSAR: number;
  defaultSellSAR: number;
  active: boolean;
  updatedAt: string;
}

export interface HotelTransfer {
  type: 'vendor' | 'client-upgrade';
  fromHotel: string;
  toHotel: string;
  date: string;
  reason?: string;
  costDeltaSAR: number;
  sellDeltaSAR: number;
}

export interface ImportSideSnapshot {
  rooms: Record<string, { qty: number | null; rate: number | null }>;
  meal: string | null;
  vat: number | null;
  trans: number | null;
  totalSAR: number | null;
  idrMasuk: number | null;
  sisaIDR: number | null;
  totalIDRActual: number | null;
}

export interface ImportSourceSnapshot {
  bookingNo: string;
  sourceNights: number | null;
  buy: ImportSideSnapshot;
  sell: ImportSideSnapshot;
  netProfitIDR: number | null;
  marginPct: number | null;
  currency: string | null;
  exchangeRate: number | null;
  notes: string | null;
}

export interface Booking {
  id: string;
  bookingRef: string;
  createdAt: string;
  updatedAt: string;
  status: PaymentStatus;
  staffName: string;
  source?: 'manual' | 'import';
  importSource?: ImportSourceSnapshot;
  visaAction?: VisaAction;
  paymentHistory?: PaymentRecord[];
  vendorPayments?: PaymentRecord[];
  bookingType?: BookingType;
  travelCompany?: string;
  vendorName?: string;
  vendorPic?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerPassport: string;
  customerCountry: string;
  groupSize: { adults: number; children: number; infants: number };
  notes?: string;
  hotelName: string;
  hotelCity: 'Makkah' | 'Madina' | 'Jeddah' | 'Riyadh' | 'Jakarta' | 'Bali' | 'Other';
  starRating: number;
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  hcnRsvp?: string;
  hotelTransfer?: HotelTransfer;
  inputCurrency: Currency;
  exchangeRate: number;
  rooms: RoomDetail[];
  additionalServices: AdditionalCostItem[];
  totalCostSAR: number;
  totalSellSAR: number;
  totalCostIDR: number;
  totalSellIDR: number;
  profitSAR: number;
  profitIDR: number;
  profitMarginPercent: number;
  amountPaidSAR: number;
  amountPaidIDR: number;
  paymentExchangeRate?: number;
  paymentMethod: PaymentMethod;
  dueDate: string;
  paymentReference?: string;
}

export interface HotelInfo {
  id: string;
  name: string;
  city: 'Makkah' | 'Madina' | 'Jeddah' | 'Riyadh' | 'Jakarta' | 'Bali' | 'Other';
  starRating: number;
  distanceToHaram?: string;
  contactPerson?: string;
  contactPhone?: string;
  defaultCostSAR: number;
  defaultSellSAR: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

export interface CompanySettings {
  companyName: string;
  tagline: string;
  logoUrl?: string;
  stampUrl?: string;
  crNumber: string;
  licenseNumber: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  defaultExchangeRateSARtoIDR: number;
  termsAndConditions: string;
  staffMembers: StaffMember[];
  defaultStaffName: string;
  importToleranceSAR?: number;
  appName?: string;
  shortName?: string;
  appDescription?: string;
  themeColor?: string;
  backgroundColor?: string;
  appIconUrl?: string;
  legalEntityName?: string;
  waPhone?: string;
  indonesiaAddress?: string;
  bookingManagerName?: string;
  bookingManagerRole?: string;
  bookingPolicy?: string[];
  cancellationPolicy?: string[];
  bankDetails: {
    saudiBank: string;
    saudiIban: string;
    indonesiaBank: string;
    indonesiaAccount: string;
    mandiriAccountName?: string;
    mandiriAccountNumber?: string;
  };
}
