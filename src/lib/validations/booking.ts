import { z } from 'zod';

export const paymentStatusSchema = z.enum(['Draft', 'Unpaid', 'Partial', 'Paid', 'Cancelled']);
export const currencySchema = z.enum(['SAR', 'IDR']);
export const bookingTypeSchema = z.enum(['Private', 'Group']);

const money = z.number().finite();

export const roomSchema = z.object({
  id: z.string().min(1),
  roomType: z.string().min(1),
  numberOfRooms: z.number().int().nonnegative(),
  costPerNight: money,
  sellPerNight: money,
  mealPlan: z.string().min(1),
});

export const extraSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  cost: money,
  sell: money,
});

export const paymentRecordSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  amountSAR: money,
  amountIDR: money,
  exchangeRate: z.number().finite().optional(),
  direction: z.enum(['customer', 'vendor']).optional(),
  method: z.string().min(1),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export const hotelBookingSchema = z.object({
  id: z.string().min(1),
  bookingRef: z.string().min(3),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: paymentStatusSchema,
  staffName: z.string(),
  source: z.enum(['manual', 'import']).optional(),
  visaAction: z.string().optional(),
  paymentHistory: z.array(paymentRecordSchema).optional(),
  vendorPayments: z.array(paymentRecordSchema).optional(),
  bookingType: bookingTypeSchema.optional(),
  travelCompany: z.string().optional(),
  vendorName: z.string().optional(),
  vendorPic: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string(),
  customerEmail: z.string(),
  customerPassport: z.string(),
  customerCountry: z.string(),
  groupSize: z.object({
    adults: z.number().int().nonnegative(),
    children: z.number().int().nonnegative(),
    infants: z.number().int().nonnegative(),
  }),
  notes: z.string().optional(),
  hotelName: z.string().min(1, 'Hotel name is required'),
  hotelCity: z.string().min(1),
  starRating: z.number().int().min(1).max(7),
  checkInDate: z.string().min(8),
  checkOutDate: z.string().min(8),
  totalNights: z.number().int().positive(),
  hcnRsvp: z.string().optional(),
  hotelTransfer: z.unknown().optional(),
  importSource: z.unknown().optional(),
  inputCurrency: currencySchema,
  exchangeRate: z.number().positive(),
  rooms: z.array(roomSchema).min(1, 'At least one room is required'),
  additionalServices: z.array(extraSchema),
  totalCostSAR: money,
  totalSellSAR: money,
  totalCostIDR: money,
  totalSellIDR: money,
  profitSAR: money,
  profitIDR: money,
  profitMarginPercent: money,
  amountPaidSAR: money,
  amountPaidIDR: money,
  paymentExchangeRate: z.number().optional(),
  paymentMethod: z.string(),
  dueDate: z.string(),
  paymentReference: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF', 'FINANCE', 'VIEWER']),
  password: z.string().min(8),
  active: z.boolean().optional(),
});
