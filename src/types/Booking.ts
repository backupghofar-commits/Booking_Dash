export type Currency = 'SAR' | 'IDR';

export type PaymentStatus = 'Draft' | 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled';

export type PaymentMethod = 'Bank Transfer (Al Rajhi)' | 'Bank Transfer (BCA/Mandiri)' | 'Credit Card' | 'Cash' | 'Credit/Invoice';

export interface RoomDetail {
  id: string;
  roomType: string; // e.g. 'Quad', 'Triple', 'Double', 'Suite', 'Single'
  numberOfRooms: number;
  costPerNight: number; // In input currency
  sellPerNight: number; // In input currency
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
  date: string; // ISO date string
  amountSAR: number;
  amountIDR: number;
  exchangeRate?: number; // Rate applied at transaction time
  direction?: PaymentDirection; // customer termin (in) or vendor payment (out)
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

export interface Customer {
  id: string;
  bookingType: BookingType;
  name: string; // Guest name (private) or lead contact (group)
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
  type: 'vendor' | 'client-upgrade'; // vendor-initiated move or client-requested upgrade
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

/** Lossless source values retained alongside normalized application fields. */
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
  bookingRef: string; // e.g. TAM-2025-101
  createdAt: string; // ISO date string
  updatedAt: string;
  status: PaymentStatus;
  staffName: string;
  source?: 'manual' | 'import'; // Origin of the record
  importSource?: ImportSourceSnapshot;
  visaAction?: VisaAction; // Visa approval workflow response
  paymentHistory?: PaymentRecord[]; // Customer termin / installment payments (in)
  vendorPayments?: PaymentRecord[]; // Payments to hotel/vendor (out)

  // Customer Details
  bookingType?: BookingType; // Private individual or Group via travel company
  travelCompany?: string; // Travel company name for group bookings
  vendorName?: string; // Room supplier / vendor company name
  vendorPic?: string; // PIC Sales contact person from the vendor
  customerName: string;
  customerPhone: string; // WhatsApp friendly
  customerEmail: string;
  customerPassport: string;
  customerCountry: string;
  groupSize: {
    adults: number;
    children: number;
    infants: number;
  };
  notes?: string;

  // Hotel & Stay
  hotelName: string;
  hotelCity: 'Makkah' | 'Madina' | 'Jeddah' | 'Riyadh' | 'Jakarta' | 'Bali' | 'Other';
  starRating: number;
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  hcnRsvp?: string; // Optional Hotel Confirmation Number / RSVP reference — triggers QR generation
  hotelTransfer?: HotelTransfer; // Filled when booking is moved by vendor or upgraded by client

  // Pricing & Currency
  inputCurrency: Currency; // Rates entered in SAR or IDR
  exchangeRate: number; // e.g., 1 SAR = 4250 IDR at time of booking

  // Room details
  rooms: RoomDetail[];
  
  // Extra Cost / Services
  additionalServices: AdditionalCostItem[];

  // Totals (stored in SAR for uniform base analytics + IDR calculated)
  totalCostSAR: number;
  totalSellSAR: number;
  totalCostIDR: number;
  totalSellIDR: number;

  // Profitability
  profitSAR: number;
  profitIDR: number;
  profitMarginPercent: number;

  // Payment Tracking
  amountPaidSAR: number;
  amountPaidIDR: number;
  paymentExchangeRate?: number; // Rate applied at payment transaction time
  paymentMethod: PaymentMethod;
  dueDate: string;
  paymentReference?: string;
}

export interface HotelInfo {
  id: string;
  name: string;
  city: 'Makkah' | 'Madina' | 'Jeddah' | 'Riyadh' | 'Jakarta' | 'Bali' | 'Other';
  starRating: number;
  distanceToHaram?: string; // e.g. "100m - Clock Tower"
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
  logoUrl?: string; // Base64 data URL or PNG image link
  stampUrl?: string; // Authorized company stamp PNG (base64)
  crNumber: string; // Commercial Registration
  licenseNumber: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  defaultExchangeRateSARtoIDR: number; // e.g. 4250
  termsAndConditions: string;
  staffMembers: StaffMember[]; // Editable issuing officers (name + role)
  defaultStaffName: string;
  // Import engine audit tolerance (SAR) — configurable precision for total validation
  importToleranceSAR?: number;

  // PWA / application branding (Settings → Application Branding)
  appName?: string;
  shortName?: string;
  appDescription?: string;
  themeColor?: string;
  backgroundColor?: string;
  appIconUrl?: string; // uploaded PNG used for favicon + PWA icons

  // Voucher branding (Confirmation Letter identity)
  legalEntityName?: string; // e.g. PT. TAMIMA JAYA WISATA
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
