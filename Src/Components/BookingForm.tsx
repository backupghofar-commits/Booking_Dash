import React, { useEffect, useMemo, useState } from 'react';
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  ArrowLeft, 
  DollarSign, 
  BedDouble, 
  Calculator, 
  CreditCard,
  ShieldCheck,
  ArrowRightLeft,
  UserCheck,
  Database,
  Users,
  QrCode as QrCodeIcon
} from 'lucide-react';
import { Booking, CompanySettings, Currency, PaymentMethod, PaymentStatus, RoomDetail, AdditionalCostItem, PaymentRecord, Customer } from '../types/booking';

interface TenorDraft {
  id: string;
  date: string;
  amount: number; // in inputCurrency
  rate: number; // SAR->IDR at transaction time
  method: PaymentMethod;
  reference: string;
}

/* Mathematical rounding: IDR to nearest whole rupiah, SAR to 2 decimals */
const roundIDR = (n: number) => Math.round(n || 0);
const roundSAR = (n: number) => Math.round((n || 0) * 100) / 100;

/* Room type catalog with default guest capacity per unit */
const ROOM_TYPES: { code: string; label: string; cap: number }[] = [
  { code: 'BED', label: 'Bed', cap: 1 },
  { code: 'DBL', label: 'Double', cap: 2 },
  { code: 'TRP', label: 'Triple', cap: 3 },
  { code: 'QRD', label: 'Quad', cap: 4 },
  { code: 'QNT', label: 'Quint', cap: 5 },
  { code: 'EXT', label: 'Extra', cap: 1 },
  { code: 'UNIT', label: 'Unit', cap: 4 },
];
const capFor = (label: string) => ROOM_TYPES.find((r) => r.label === label)?.cap ?? 2;
import { calculateNights, computeBookingTotals, getProfitMarginBadge, formatSAR, formatIDR } from '../utils/currency';
import { RiyalIcon } from './RiyalIcon';
import { generateInvoiceRef } from '../utils/invoiceRef';
import { History } from 'lucide-react';

interface BookingFormProps {
  initialBooking?: Booking | null;
  settings: CompanySettings;
  customers: Customer[];
  onSave: (booking: Booking, openVoucherAfter: boolean) => void;
  onCancel: () => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  initialBooking,
  settings,
  customers,
  onSave,
  onCancel,
}) => {
  // Form State
  const [staffName, setStaffName] = useState(
    initialBooking?.staffName || settings.defaultStaffName || settings.staffMembers?.[0]?.name || 'Staff Administrator'
  );
  const [customStaff, setCustomStaff] = useState('');
  const [isCustomStaff, setIsCustomStaff] = useState(
    Boolean(
      initialBooking?.staffName &&
        settings.staffMembers &&
        !settings.staffMembers.some((s) => s.name === initialBooking.staffName)
    )
  );
  const [bookingRef, setBookingRef] = useState(initialBooking?.bookingRef || generateInvoiceRef());
  const [status, setStatus] = useState<PaymentStatus>(initialBooking?.status || 'Unpaid');

  // Customer State
  const [bookingType, setBookingType] = useState<'Private' | 'Group'>(initialBooking?.bookingType || 'Private');
  const [travelCompany, setTravelCompany] = useState(initialBooking?.travelCompany || '');
  const [customerName, setCustomerName] = useState(initialBooking?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initialBooking?.customerPhone || '');
  const [customerEmail, setCustomerEmail] = useState(initialBooking?.customerEmail || '');
  const [customerPassport, setCustomerPassport] = useState(initialBooking?.customerPassport || '');
  const [customerCountry, setCustomerCountry] = useState(initialBooking?.customerCountry || 'Indonesia');
  const [adults, setAdults] = useState(initialBooking?.groupSize.adults || 2);
  const [children, setChildren] = useState(initialBooking?.groupSize.children || 0);
  const [infants, setInfants] = useState(initialBooking?.groupSize.infants || 0);
  const [notes, setNotes] = useState(initialBooking?.notes || '');

  // ===== Customer autofill (saved directory) =====
  const [showCustSuggest, setShowCustSuggest] = useState(false);

  const custMatches = useMemo(() => {
    const q = (bookingType === 'Group' ? travelCompany : customerName).trim().toLowerCase();
    if (q.length < 2) return [];
    return customers
      .filter((c) => `${c.name} ${c.travelCompany || ''} ${c.phone} ${c.passport || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.bookingType === bookingType ? -1 : 1) - (b.bookingType === bookingType ? -1 : 1))
      .slice(0, 6);
  }, [customers, customerName, travelCompany, bookingType]);

  const savedCustomer = useMemo(() => {
    const key = (bookingType === 'Group' ? travelCompany : customerName).trim().toLowerCase();
    if (!key) return undefined;
    return customers.find(
      (c) =>
        c.bookingType === bookingType &&
        (bookingType === 'Group'
          ? (c.travelCompany || '').toLowerCase() === key
          : c.name.toLowerCase() === key)
    );
  }, [customers, customerName, travelCompany, bookingType]);

  const applyCustomer = (c: Customer) => {
    setBookingType(c.bookingType);
    setCustomerName(c.name);
    setTravelCompany(c.travelCompany || '');
    if (c.phone) setCustomerPhone(c.phone);
    if (c.email) setCustomerEmail(c.email);
    if (c.passport) setCustomerPassport(c.passport);
    if (c.country) setCustomerCountry(c.country);
    setShowCustSuggest(false);
  };

  const suggestDropdown = showCustSuggest && custMatches.length > 0 && (
    <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-[fadeIn_.15s_ease-out]">
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <p className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800 flex items-center gap-1">
        <Database className="w-3 h-3 text-emerald-600" /> Customer Tersimpan — klik untuk auto-fill
      </p>
      {custMatches.map((c) => (
        <button
          key={c.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            applyCustomer(c);
          }}
          className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800 first:border-t-0"
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                c.bookingType === 'Group' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {c.bookingType === 'Group' ? 'GROUP' : 'PRIV'}
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {c.bookingType === 'Group' ? c.travelCompany || c.name : c.name}
            </span>
            {c.lastBookingRef && <span className="ml-auto text-[9px] font-mono text-slate-400">{c.lastBookingRef}</span>}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {c.bookingType === 'Group' ? `PIC ${c.name} · ` : ''}
            {c.phone}
            {c.country ? ` · ${c.country}` : ''}
          </p>
        </button>
      ))}
    </div>
  );

  const savedChip = savedCustomer && (
    <span className="inline-flex items-center gap-1 text-[8px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded">
      <UserCheck className="w-2.5 h-2.5" /> TERSIMPAN
    </span>
  );

  // Hotel & Stay State (manual entry + room supplier details)
  const [hotelName, setHotelName] = useState(initialBooking?.hotelName || '');
  const [hcnRsvp, setHcnRsvp] = useState(initialBooking?.hcnRsvp || '');
  const [vendorName, setVendorName] = useState(initialBooking?.vendorName || '');
  const [vendorPic, setVendorPic] = useState(initialBooking?.vendorPic || '');
  const [hotelCity, setHotelCity] = useState<'Makkah' | 'Madina' | 'Jeddah' | 'Riyadh' | 'Jakarta' | 'Bali' | 'Other'>(
    initialBooking?.hotelCity || 'Makkah'
  );
  const [starRating, setStarRating] = useState(initialBooking?.starRating || 5);
  const [checkInDate, setCheckInDate] = useState(
    initialBooking?.checkInDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [checkOutDate, setCheckOutDate] = useState(
    initialBooking?.checkOutDate || new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0]
  );

  // Hotel Transfer / Upgrade state
  const [transferEnabled, setTransferEnabled] = useState<boolean>(!!initialBooking?.hotelTransfer);
  const [transferType, setTransferType] = useState<'vendor' | 'client-upgrade'>(
    initialBooking?.hotelTransfer?.type || 'vendor'
  );
  const [fromHotel, setFromHotel] = useState(initialBooking?.hotelTransfer?.fromHotel || '');
  const [toHotel, setToHotel] = useState(initialBooking?.hotelTransfer?.toHotel || initialBooking?.hotelName || '');
  const [transferDate, setTransferDate] = useState(
    initialBooking?.hotelTransfer?.date || new Date().toISOString().split('T')[0]
  );
  const [transferReason, setTransferReason] = useState(initialBooking?.hotelTransfer?.reason || '');
  const [costDelta, setCostDelta] = useState(initialBooking?.hotelTransfer?.costDeltaSAR || 0);
  const [sellDelta, setSellDelta] = useState(initialBooking?.hotelTransfer?.sellDeltaSAR || 0);

  // Financial & Currency
  const [inputCurrency] = useState<Currency>(initialBooking?.inputCurrency || 'SAR');
  const [exchangeRate, setExchangeRate] = useState<number>(
    initialBooking?.exchangeRate || settings.defaultExchangeRateSARtoIDR || 4250
  );

  // Rooms List
  const [rooms, setRooms] = useState<RoomDetail[]>(
    initialBooking?.rooms || [
      {
        id: 'r-1',
        roomType: 'Quad Haram View',
        numberOfRooms: 1,
        costPerNight: 750,
        sellPerNight: 950,
        mealPlan: 'Breakfast',
      },
    ]
  );

  // Additional Services
  const [additionalServices, setAdditionalServices] = useState<AdditionalCostItem[]>(
    initialBooking?.additionalServices || []
  );

  // Payment State
  const [amountPaidInput, setAmountPaidInput] = useState<number>(
    initialBooking
      ? initialBooking.inputCurrency === 'SAR'
        ? initialBooking.amountPaidSAR
        : initialBooking.amountPaidIDR
      : 0
  );
  const [paymentRate, setPaymentRate] = useState<number>(
    initialBooking?.paymentExchangeRate || initialBooking?.exchangeRate || settings.defaultExchangeRateSARtoIDR || 4250
  );
  const [paymentMode, setPaymentMode] = useState<'single' | 'tenor'>(
    initialBooking?.paymentHistory && initialBooking.paymentHistory.length > 0 ? 'tenor' : 'single'
  );
  const [tenors, setTenors] = useState<TenorDraft[]>(() => {
    if (initialBooking?.paymentHistory?.length) {
      return initialBooking.paymentHistory.map((p) => ({
        id: p.id,
        date: p.date.slice(0, 10),
        amount: initialBooking.inputCurrency === 'SAR' ? p.amountSAR : p.amountIDR,
        rate: p.exchangeRate || initialBooking.exchangeRate || 4250,
        method: p.method,
        reference: p.reference || '',
      }));
    }
    return [];
  });
  const [vendorPays, setVendorPays] = useState<TenorDraft[]>(() => {
    if (initialBooking?.vendorPayments?.length) {
      return initialBooking.vendorPayments.map((p) => ({
        id: p.id,
        date: p.date.slice(0, 10),
        amount: initialBooking.inputCurrency === 'SAR' ? p.amountSAR : p.amountIDR,
        rate: p.exchangeRate || initialBooking.exchangeRate || 4250,
        method: p.method,
        reference: p.reference || '',
      }));
    }
    return [];
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialBooking?.paymentMethod || 'Bank Transfer (Al Rajhi)'
  );
  const [dueDate, setDueDate] = useState(
    initialBooking?.dueDate || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [paymentReference, setPaymentReference] = useState(initialBooking?.paymentReference || '');

  // Auto calculate nights
  const totalNights = calculateNights(checkInDate, checkOutDate);

  // Auto calculations from utility
  const totals = computeBookingTotals(
    rooms,
    additionalServices,
    totalNights,
    inputCurrency,
    exchangeRate,
    amountPaidInput,
    paymentRate
  );

  const marginBadge = getProfitMarginBadge(totals.profitMarginPercent);

  // Tenor-aware paid totals (each installment converted at its own transaction rate)
  const tenorPaid = tenors.reduce(
    (acc, t) => {
      const r = t.rate > 0 ? t.rate : paymentRate;
      if (inputCurrency === 'SAR') {
        acc.sar += t.amount || 0;
        acc.idr += (t.amount || 0) * r;
      } else {
        acc.idr += t.amount || 0;
        acc.sar += r > 0 ? (t.amount || 0) / r : 0;
      }
      return acc;
    },
    { sar: 0, idr: 0 }
  );

  const paidSAR = paymentMode === 'tenor' ? tenorPaid.sar : totals.amountPaidSAR;
  const paidIDR = paymentMode === 'tenor' ? tenorPaid.idr : totals.amountPaidIDR;
  const remSAR = totals.totalSellSAR - paidSAR;
  const remIDR = totals.totalSellIDR - paidIDR;

  // Auto-sync payment status to what the customer has actually paid the company
  // (Draft & Cancelled stay under manual control).
  useEffect(() => {
    if (status === 'Draft' || status === 'Cancelled') return;
    const next: PaymentStatus = remSAR <= 0.5 && paidSAR > 0 ? 'Paid' : paidSAR > 0 ? 'Partial' : 'Unpaid';
    if (next !== status) setStatus(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidSAR, remSAR]);

  // ===== Live profit-engine derived states =====
  const settled = remSAR <= 0.5 && paidSAR > 0;
  const overpaidBill = remSAR < -0.5;
  const billPaidPct =
    totals.totalSellSAR > 0 ? Math.min(100, Math.round((paidSAR / totals.totalSellSAR) * 100)) : paidSAR > 0 ? 100 : 0;
  // Realized profit uses the accumulated transaction-rate conversion once settled;
  // until then it stays an estimate at the current payment rate.
  const realizedProfitIDR = paidIDR - totals.totalCostIDR;
  const estimatedProfitIDR = totals.profitSAR * (paymentRate || exchangeRate || 0);

  // Counter-currency value for single payment (auto-exchange, mathematically rounded)
  const singleCounterValue =
    inputCurrency === 'SAR'
      ? roundIDR((amountPaidInput || 0) * (paymentRate || 0))
      : roundSAR((paymentRate || 0) > 0 ? (amountPaidInput || 0) / paymentRate : 0);

  const addTenor = () =>
    setTenors((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        rate: paymentRate,
        method: paymentMethod,
        reference: '',
      },
    ]);

  const updateTenor = (id: string, patch: Partial<TenorDraft>) =>
    setTenors((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTenor = (id: string) => setTenors((prev) => prev.filter((t) => t.id !== id));

  const settleRemainingAsTenor = () => {
    const remaining = inputCurrency === 'SAR' ? remSAR : remIDR;
    if (remaining <= 0) return;
    setTenors((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        amount: Math.round(remaining * 100) / 100,
        rate: paymentRate,
        method: paymentMethod,
        reference: 'PELUNASAN',
      },
    ]);
    setStatus('Paid');
  };

  // Vendor payment totals (each converted at its own transaction rate)
  const vendorPaid = vendorPays.reduce(
    (acc, t) => {
      const r = t.rate > 0 ? t.rate : paymentRate;
      if (inputCurrency === 'SAR') {
        acc.sar += t.amount || 0;
        acc.idr += (t.amount || 0) * r;
      } else {
        acc.idr += t.amount || 0;
        acc.sar += r > 0 ? (t.amount || 0) / r : 0;
      }
      return acc;
    },
    { sar: 0, idr: 0 }
  );

  const addVendorPay = () =>
    setVendorPays((prev) => [
      ...prev,
      {
        id: `v-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        rate: paymentRate,
        method: 'Bank Transfer (Al Rajhi)',
        reference: '',
      },
    ]);

  const updateVendorPay = (id: string, patch: Partial<TenorDraft>) =>
    setVendorPays((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeVendorPay = (id: string) => setVendorPays((prev) => prev.filter((t) => t.id !== id));

  // Auto-fill guest count from room mix (editable afterwards)
  const syncGuests = (nextRooms: RoomDetail[]) => {
    const total = nextRooms.reduce((s, r) => s + (r.numberOfRooms || 0) * capFor(r.roomType), 0);
    setAdults(Math.max(1, total));
  };

  // Add / Remove Rooms
  const addRoom = () => {
    const next = [
      ...rooms,
      {
        id: `r-${Date.now()}`,
        roomType: 'Double',
        numberOfRooms: 1,
        costPerNight: inputCurrency === 'SAR' ? 600 : 2550000,
        sellPerNight: inputCurrency === 'SAR' ? 800 : 3400000,
        mealPlan: 'Breakfast' as RoomDetail['mealPlan'],
      },
    ];
    setRooms(next);
    syncGuests(next);
  };

  const removeRoom = (id: string) => {
    if (rooms.length > 1) {
      const next = rooms.filter((r) => r.id !== id);
      setRooms(next);
      syncGuests(next);
    }
  };

  const updateRoom = <K extends keyof RoomDetail>(id: string, field: K, value: RoomDetail[K]) => {
    const next = rooms.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    setRooms(next);
    if (field === 'roomType' || field === 'numberOfRooms') syncGuests(next);
  };

  // Live group-size math: qty × capacity per room type → total pax
  const paxLines = rooms.map((r) => {
    const t = ROOM_TYPES.find((x) => x.label === r.roomType);
    const code = t?.code || r.roomType.slice(0, 3).toUpperCase();
    const qty = r.numberOfRooms || 0;
    return { id: r.id, code, label: r.roomType, qty, pax: qty * (t?.cap ?? 2) };
  });
  const totalPax = paxLines.reduce((s, l) => s + l.pax, 0);

  // Add / Remove Additional Services
  const addService = () => {
    setAdditionalServices([
      ...additionalServices,
      {
        id: `s-${Date.now()}`,
        description: 'Airport Transfer GMC',
        cost: inputCurrency === 'SAR' ? 300 : 1275000,
        sell: inputCurrency === 'SAR' ? 450 : 1912500,
      },
    ]);
  };

  const removeService = (id: string) => {
    setAdditionalServices(additionalServices.filter((s) => s.id !== id));
  };

  const updateService = <K extends keyof AdditionalCostItem>(
    id: string,
    field: K,
    value: AdditionalCostItem[K]
  ) => {
    setAdditionalServices(
      additionalServices.map((s) => {
        if (s.id === id) {
          return { ...s, [field]: value };
        }
        return s;
      })
    );
  };

  // Save Booking
  const handleSubmit = (e: React.FormEvent, openVoucherAfter: boolean = false) => {
    e.preventDefault();

    if (!customerName.trim()) {
      alert('Please enter customer full name.');
      return;
    }

    if (bookingType === 'Group' && !travelCompany.trim()) {
      alert('Please enter the Travel Company name for group bookings.');
      return;
    }

    if (!hotelName.trim()) {
      alert('Please enter hotel name.');
      return;
    }

    if (paymentMode === 'tenor' && tenors.some((t) => t.amount <= 0)) {
      alert('Setiap tenor harus memiliki jumlah lebih dari 0.');
      return;
    }

    // Auto-adjust payment status based on collected amount
    let finalStatus: PaymentStatus = status;
    if (status !== 'Cancelled' && status !== 'Draft') {
      if (remSAR <= 0.5 && paidSAR > 0) finalStatus = 'Paid';
      else if (paidSAR > 0) finalStatus = 'Partial';
      else finalStatus = 'Unpaid';
    }

    const tenorHistory: PaymentRecord[] =
      paymentMode === 'tenor'
        ? tenors.map((t, i) => {
            const r = t.rate > 0 ? t.rate : paymentRate;
            const d = new Date(`${t.date}T12:00:00`).toISOString();
            return inputCurrency === 'SAR'
              ? {
                  id: t.id,
                  date: d,
                  amountSAR: t.amount,
                  amountIDR: Math.round(t.amount * r),
                  exchangeRate: r,
                  method: t.method,
                  reference: t.reference || undefined,
                  note: `Tenor ${i + 1}`,
                }
              : {
                  id: t.id,
                  date: d,
                  amountSAR: Math.round((t.amount / r) * 100) / 100,
                  amountIDR: t.amount,
                  exchangeRate: r,
                  method: t.method,
                  reference: t.reference || undefined,
                  note: `Tenor ${i + 1}`,
                };
          })
        : initialBooking?.paymentHistory || [];

    const vendorHistory: PaymentRecord[] = vendorPays
      .filter((t) => t.amount > 0)
      .map((t, i) => {
        const r = t.rate > 0 ? t.rate : paymentRate;
        const d = new Date(`${t.date}T12:00:00`).toISOString();
        return inputCurrency === 'SAR'
          ? {
              id: t.id,
              date: d,
              amountSAR: t.amount,
              amountIDR: Math.round(t.amount * r),
              exchangeRate: r,
              direction: 'vendor' as const,
              method: t.method,
              reference: t.reference || undefined,
              note: `Vendor payment ${i + 1}`,
            }
          : {
              id: t.id,
              date: d,
              amountSAR: Math.round((t.amount / r) * 100) / 100,
              amountIDR: t.amount,
              exchangeRate: r,
              direction: 'vendor' as const,
              method: t.method,
              reference: t.reference || undefined,
              note: `Vendor payment ${i + 1}`,
            };
      });

    const newBooking: Booking = {
      id: initialBooking?.id || `b-${Date.now()}`,
      bookingRef,
      createdAt: initialBooking?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: finalStatus,
      staffName,
      paymentHistory: tenorHistory,
      vendorPayments: vendorHistory,

      bookingType,
      travelCompany: bookingType === 'Group' ? travelCompany : undefined,
      vendorName: vendorName.trim() || undefined,
      vendorPic: vendorPic.trim() || undefined,
      customerName,
      customerPhone,
      customerEmail,
      customerPassport,
      customerCountry,
      groupSize: {
        adults: Number(adults),
        children: Number(children),
        infants: Number(infants),
      },
      notes,

      hotelName: transferEnabled && toHotel ? toHotel : hotelName,
      hotelCity,
      starRating: Number(starRating),
      checkInDate,
      checkOutDate,
      totalNights,
      hcnRsvp: hcnRsvp.trim() || undefined,
      hotelTransfer: transferEnabled
        ? {
            type: transferType,
            fromHotel: fromHotel || hotelName,
            toHotel: toHotel || hotelName,
            date: transferDate,
            reason: transferReason || undefined,
            costDeltaSAR: costDelta,
            sellDeltaSAR: sellDelta,
          }
        : undefined,

      inputCurrency,
      exchangeRate: Number(exchangeRate),

      rooms,
      additionalServices,

      totalCostSAR: totals.totalCostSAR,
      totalSellSAR: totals.totalSellSAR,
      totalCostIDR: totals.totalCostIDR,
      totalSellIDR: totals.totalSellIDR,

      profitSAR: totals.profitSAR,
      profitIDR: totals.profitIDR,
      profitMarginPercent: totals.profitMarginPercent,

      amountPaidSAR: Math.round(paidSAR * 100) / 100,
      amountPaidIDR: Math.round(paidIDR),
      paymentExchangeRate:
        paymentMode === 'tenor' ? tenors[tenors.length - 1]?.rate || totals.paymentRate : totals.paymentRate,
      paymentMethod,
      dueDate,
      paymentReference,
    };

    onSave(newBooking, openVoucherAfter);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              {initialBooking ? 'Edit Booking Record' : 'Create New Booking'}
            </h2>
            <p className="text-xs text-slate-500 font-mono font-bold tracking-wide">Invoice Ref: {bookingRef}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ===== LIVE PROFIT ENGINE — sticky while scrolling ===== */}
      <div className="sticky top-[140px] md:top-[93px] z-20 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-4 md:p-5 shadow-2xl border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.18em]">
                Live Profit Engine Calculation
              </p>
              <h3 className="text-lg font-extrabold text-white leading-tight">
                Total Bill: {formatSAR(totals.totalSellSAR)}{' '}
                <span className="text-slate-300 text-sm font-bold">({formatIDR(totals.totalSellIDR)})</span>
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
              <span className="text-slate-400 block font-bold uppercase text-[10px] tracking-wider">HPP / Buy (Cost)</span>
              <span className="font-bold text-slate-200 text-sm flex items-center space-x-1">
                <RiyalIcon className="w-3.5 h-3.5 text-rose-400" />
                <span>{formatSAR(totals.totalCostSAR)}</span>
              </span>
              <span className="text-slate-400 text-[10px]">{formatIDR(totals.totalCostIDR)}</span>
            </div>

            <div className="bg-sky-900/50 p-2.5 rounded-xl border border-sky-700/60">
              <span className="text-sky-300 block font-bold uppercase text-[10px] tracking-wider">Sell Price</span>
              <span className="font-bold text-sky-200 text-sm flex items-center space-x-1">
                <RiyalIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>{formatSAR(totals.totalSellSAR)}</span>
              </span>
              <span className="text-sky-300/80 text-[10px]">{formatIDR(totals.totalSellIDR)}</span>
            </div>

            {/* Net profit: blinking estimate until customer payment settles, then solid green realized */}
            <div
              className={`p-2.5 rounded-xl border transition-colors ${
                settled
                  ? 'bg-emerald-600/30 border-emerald-400'
                  : 'bg-amber-900/40 border-amber-500/70'
              }`}
            >
              <span
                className={`block font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 ${
                  settled ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                Net Profit
                <span
                  className={`text-[7.5px] font-black px-1 py-px rounded ${
                    settled ? 'bg-emerald-400 text-emerald-950' : 'bg-amber-400 text-amber-950 alarm-slow'
                  }`}
                >
                  {settled ? 'REALISASI' : 'ESTIMASI'}
                </span>
              </span>
              <span
                className={`font-extrabold text-sm flex items-center space-x-1 ${
                  settled ? 'text-emerald-300' : 'text-amber-300 alarm-mid'
                }`}
              >
                <RiyalIcon className="w-3.5 h-3.5" />
                <span>{formatSAR(totals.profitSAR)}</span>
              </span>
              <span className={`text-[10px] ${settled ? 'text-emerald-300/90' : 'text-amber-300/80'}`}>
                {settled ? formatIDR(realizedProfitIDR) : `≈ ${formatIDR(estimatedProfitIDR)}`}
              </span>
            </div>

            <div className={`p-2.5 rounded-xl border font-bold text-center flex flex-col justify-center ${marginBadge.bgClass}`}>
              <span>{totals.profitMarginPercent.toFixed(1)}% Margin</span>
              <span className="text-[10px] uppercase font-semibold">{marginBadge.label}</span>
            </div>
          </div>
        </div>

        {/* Payment absorption strip: every recorded payment reduces the outstanding bill */}
        <div className="mt-3 pt-3 border-t border-slate-700/70 grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-emerald-900/40 border border-emerald-700/60 rounded-xl px-2.5 py-2">
            <span className="text-emerald-300 block font-bold uppercase text-[9px] tracking-wider">Paid (Tercatat)</span>
            <span className="font-black text-emerald-300 text-sm">{formatSAR(paidSAR)}</span>
            <span className="text-emerald-300/70 text-[10px] block">{formatIDR(paidIDR)}</span>
          </div>
          <div
            className={`border rounded-xl px-2.5 py-2 ${
              overpaidBill
                ? 'bg-teal-900/40 border-teal-500/70'
                : remSAR > 0.5
                  ? 'bg-rose-900/40 border-rose-600/70'
                  : 'bg-emerald-900/40 border-emerald-600/70'
            }`}
          >
            <span
              className={`block font-bold uppercase text-[9px] tracking-wider ${
                overpaidBill ? 'text-teal-300' : remSAR > 0.5 ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {overpaidBill ? 'Balance Deposit' : 'Outstanding'}
            </span>
            <span
              className={`font-black text-sm ${
                overpaidBill ? 'text-teal-300' : remSAR > 0.5 ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {formatSAR(Math.abs(remSAR))}
            </span>
            <span
              className={`text-[10px] block ${
                overpaidBill ? 'text-teal-300/70' : remSAR > 0.5 ? 'text-rose-300/70' : 'text-emerald-300/70'
              }`}
            >
              {formatIDR(Math.abs(remIDR))}
              {overpaidBill && ' · kelebihan bayar'}
            </span>
          </div>
          <div className="col-span-2 lg:col-span-2 flex flex-col justify-center">
            <div className="flex justify-between text-[9px] font-bold text-slate-300 mb-1">
              <span>PELUNASAN TAGIHAN</span>
              <span className={settled ? 'text-emerald-300' : 'text-amber-300'}>{billPaidPct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-700/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  overpaidBill ? 'bg-teal-400' : settled ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-400 to-orange-500'
                }`}
                style={{ width: `${Math.min(100, billPaidPct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => handleSubmit(e, false)}
        className="space-y-6"
        onInput={(e) => {
          // Strip leading zeros on every numeric field while typing ("05" → "5")
          const t = e.target as HTMLInputElement;
          if (t && t.type === 'number') {
            const stripped = t.value.replace(/^0+(?=\d)/, '');
            if (stripped !== t.value) t.value = stripped;
          }
        }}
      >
        {/* Section 1: General & Ref Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>1. Invoice Reference & Staff Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Ref. #</label>
              <input
                type="text"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Issuing Staff / Officer *
              </label>
              {!isCustomStaff ? (
                <div className="flex space-x-1">
                  <select
                    value={staffName}
                    onChange={(e) => {
                      if (e.target.value === '__OTHER__') {
                        setIsCustomStaff(true);
                        setCustomStaff('');
                      } else {
                        setStaffName(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    {(settings.staffMembers && settings.staffMembers.length > 0
                      ? settings.staffMembers
                      : [
                          { id: 'fb-1', name: 'Hafiz Rahmani', role: 'Booking Officer' },
                          { id: 'fb-2', name: 'Amina Al-Mansoor', role: 'Sales' },
                          { id: 'fb-3', name: 'Staff Administrator', role: 'Admin' },
                        ]
                    ).map((st) => (
                      <option key={st.id} value={st.name}>
                        {st.name}
                        {st.role ? ` — ${st.role}` : ''}
                      </option>
                    ))}
                    <option value="__OTHER__">+ Enter Custom Staff...</option>
                  </select>
                </div>
              ) : (
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={customStaff}
                    onChange={(e) => {
                      setCustomStaff(e.target.value);
                      setStaffName(e.target.value);
                    }}
                    placeholder="Enter Staff Name..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomStaff(false);
                      setStaffName(settings.staffMembers?.[0]?.name || 'Staff Administrator');
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                  >
                    List
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                Payment Status
                <span className="text-[8px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded">
                  AUTO-SYNC
                </span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              >
                <option value="Draft">Draft Quote</option>
                <option value="Unpaid">Confirmed / Unpaid</option>
                <option value="Partial">Partial Deposit Paid</option>
                <option value="Paid">Fully Paid</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Customer Details */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <User className="w-4 h-4 text-emerald-600" />
            <span>2. Customer & Guest Details</span>
          </h3>

          {/* Booking Type Toggle: Private vs Group */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Booking Category:</span>
            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setBookingType('Private')}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-1.5 rounded-lg transition-all ${
                  bookingType === 'Private'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Private — Name & ID</span>
              </button>
              <button
                type="button"
                onClick={() => setBookingType('Group')}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-1.5 rounded-lg transition-all ${
                  bookingType === 'Group'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Group — Travel Company</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {bookingType === 'Group' && (
              <div className="sm:col-span-2">
                <label className="block font-semibold text-orange-700 dark:text-orange-400 mb-1 flex items-center gap-1.5">
                  Travel Company Name * {savedChip}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-orange-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={travelCompany}
                    onChange={(e) => {
                      setTravelCompany(e.target.value);
                      setShowCustSuggest(true);
                    }}
                    onFocus={() => setShowCustSuggest(true)}
                    onBlur={() => setTimeout(() => setShowCustSuggest(false), 150)}
                    placeholder="e.g. PT Zatabbaru Travel — ketik untuk auto-fill"
                    className="w-full pl-9 pr-3 py-2 border-2 border-orange-300 rounded-xl font-bold text-slate-900 dark:text-white bg-orange-50/50 dark:bg-slate-800 focus:ring-2 focus:ring-orange-500"
                    required
                  />
                  {suggestDropdown}
                </div>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                {bookingType === 'Group' ? 'Lead Contact Person *' : 'Guest Full Name (as in Passport) *'}{' '}
                {bookingType === 'Private' && savedChip}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (bookingType === 'Private') setShowCustSuggest(true);
                  }}
                  onFocus={() => bookingType === 'Private' && setShowCustSuggest(true)}
                  onBlur={() => setTimeout(() => setShowCustSuggest(false), 150)}
                  placeholder={
                    bookingType === 'Group'
                      ? 'e.g. Hj. Ratna Dewi'
                      : 'e.g. H. Bambang Supriyadi — ketik untuk auto-fill'
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900 dark:text-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500"
                  required
                />
                {bookingType === 'Private' && suggestDropdown}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">WhatsApp / Phone *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+628123456789"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Passport / National ID</label>
              <input
                type="text"
                value={customerPassport}
                onChange={(e) => setCustomerPassport(e.target.value)}
                placeholder="A1234567"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Country / Residence</label>
              <input
                type="text"
                value={customerCountry}
                onChange={(e) => setCustomerCountry(e.target.value)}
                placeholder="Indonesia"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Group Size Breakdown</span>
                <span className="text-[8px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded">
                  AUTO = {totalPax} PAX
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500">Adults</span>
                  <input
                    type="number"
                    min="1"
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Children</span>
                  <input
                    type="number"
                    min="0"
                    value={children}
                    onChange={(e) => setChildren(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Infants</span>
                  <input
                    type="number"
                    min="0"
                    value={infants}
                    onChange={(e) => setInfants(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Hotel & Stay Details */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>3. Accommodation & Stay Dates</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hotel Name (manual) *
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-emerald-600 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder="e.g. Pullman Zamzam Makkah"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-rose-700 dark:text-rose-400 mb-1">
                Vendor / Supplier Room *
              </label>
              <div className="relative">
                <Database className="w-4 h-4 text-rose-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. One Investment"
                  className="w-full pl-9 pr-3 py-2 bg-rose-50/50 dark:bg-slate-800 border border-rose-300 dark:border-rose-800 rounded-xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-sky-700 dark:text-sky-400 mb-1">PIC Sales Vendor</label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-sky-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={vendorPic}
                  onChange={(e) => setVendorPic(e.target.value)}
                  placeholder="e.g. Mr. Khalid"
                  className="w-full pl-9 pr-3 py-2 bg-sky-50/50 dark:bg-slate-800 border border-sky-300 dark:border-sky-800 rounded-xl font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">City</label>
              <select
                value={hotelCity}
                onChange={(e) => setHotelCity(e.target.value as Booking['hotelCity'])}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
              >
                <option value="Makkah">Makkah</option>
                <option value="Madina">Madina</option>
                <option value="Jeddah">Jeddah</option>
                <option value="Riyadh">Riyadh</option>
                <option value="Jakarta">Jakarta</option>
                <option value="Bali">Bali</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Star Rating</label>
              <select
                value={starRating}
                onChange={(e) => setStarRating(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
              >
                <option value={5}>5 Stars ★★★★★</option>
                <option value={4}>4 Stars ★★★★</option>
                <option value={3}>3 Stars ★★★</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Check-In Date</label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Check-Out Date</label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div className="sm:col-span-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-emerald-800 font-bold block">Duration Calculated</span>
                <span className="text-[11px] text-emerald-600">Check-In 16:00 / Check-Out 12:00</span>
              </div>
              <span className="text-xl font-black text-emerald-900">{totalNights} Night(s)</span>
            </div>

            {/* Optional HCN / RSVP # — generates QR on voucher when filled */}
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <QrCodeIcon className="w-3.5 h-3.5 text-indigo-600" />
                  HCN / RSVP # <span className="text-[9px] font-bold text-slate-400">(optional)</span>
                </span>
                {hcnRsvp.trim() && (
                  <span className="text-[8px] font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 px-1.5 py-0.5 rounded animate-pulse">
                    BARCODE AKTIF
                  </span>
                )}
              </label>
              <input
                type="text"
                value={hcnRsvp}
                onChange={(e) => setHcnRsvp(e.target.value)}
                placeholder="e.g. HCN-88213 / RSVP-2026-0091"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold tracking-wider text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Bila diisi, Check-In Pass (QR pesan welcome + barcode HCN) otomatis tampil di tengah Confirmation Letter & export PDF.
              </p>
            </div>
          </div>

          {/* ===== Hotel Transfer / Upgrade ===== */}
          <div
            className={`rounded-xl border-2 p-4 space-y-3 transition-colors ${
              transferEnabled
                ? 'border-sky-400 bg-sky-50/70 dark:bg-sky-950/20 dark:border-sky-700'
                : 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`p-2 rounded-lg ${transferEnabled ? 'bg-sky-600 text-white shadow' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </span>
                <div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider block">
                    Hotel Transfer / Upgrade
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Isi saat booking pindah hotel dari vendor atau di-upgrade oleh client
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTransferEnabled(!transferEnabled);
                  if (!transferEnabled && !fromHotel) setFromHotel(hotelName);
                }}
                className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors flex-shrink-0 ${
                  transferEnabled ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
                aria-pressed={transferEnabled}
              >
                <span
                  className={`inline-block h-4.5 w-4.5 transform transition-transform bg-white rounded-full shadow ${
                    transferEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                  style={{ width: 18, height: 18 }}
                />
              </button>
            </div>

            {transferEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Jenis Perpindahan</label>
                  <select
                    value={transferType}
                    onChange={(e) => setTransferType(e.target.value as 'vendor' | 'client-upgrade')}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                  >
                    <option value="vendor">Pindah Hotel dari Vendor</option>
                    <option value="client-upgrade">Upgrade oleh Client</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Hotel Asal (Sebelum Pindah)</label>
                  <input
                    type="text"
                    value={fromHotel}
                    onChange={(e) => setFromHotel(e.target.value)}
                    placeholder="e.g. Anjum Hotel Makkah"
                    className="w-full px-3 py-2 border border-rose-300 rounded-xl font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-emerald-700 mb-1">Hotel Tujuan (Baru)</label>
                  <input
                    type="text"
                    value={toHotel}
                    onChange={(e) => setToHotel(e.target.value)}
                    placeholder="e.g. Swissôtel Makkah"
                    className="w-full px-3 py-2 border border-emerald-300 rounded-xl font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tanggal Efektif</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alasan / Catatan {transferType === 'client-upgrade' ? 'Upgrade' : 'Perpindahan'}
                  </label>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder={
                      transferType === 'client-upgrade'
                        ? 'e.g. Client request view Kaaba, naik ke kategori suite'
                        : 'e.g. Overbooked oleh vendor, dialihkan ke hotel setara'
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-rose-700 mb-1">Selisih Cost (SAR)</label>
                  <input
                    type="number"
                    value={costDelta}
                    onChange={(e) => setCostDelta(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-rose-300 rounded-xl font-bold text-rose-900 dark:text-rose-300 bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-emerald-700 mb-1">Selisih Tagihan Client (SAR)</label>
                  <input
                    type="number"
                    value={sellDelta}
                    onChange={(e) => setSellDelta(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-emerald-300 rounded-xl font-bold text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-rose-600">{fromHotel || 'Hotel Asal'}</span>
                    <ArrowRightLeft className="w-3.5 h-3.5 inline mx-1.5 text-sky-600" />
                    <span className="font-bold text-emerald-600">{toHotel || 'Hotel Tujuan'}</span>
                    <span className="ml-2 text-slate-400">
                      · {transferType === 'client-upgrade' ? 'Upgrade client' : 'Alih vendor'} · {transferDate}
                    </span>
                  </p>
                  <div className="flex items-center gap-3 text-[11px] font-black">
                    <span className="text-rose-600">Δ Cost {costDelta >= 0 ? '+' : ''}{costDelta.toLocaleString('id-ID')}</span>
                    <span className="text-emerald-600">Δ Sell {sellDelta >= 0 ? '+' : ''}{sellDelta.toLocaleString('id-ID')}</span>
                    <button
                      type="button"
                      onClick={() => setHotelName(toHotel)}
                      disabled={!toHotel}
                      className="bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Jadikan Hotel Tujuan sebagai Hotel Booking
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Currency & Rooms Pricing (Core Profit Engine) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>4. Currency & Room Rate Breakdown</span>
            </h3>

            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1 text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                <span>1 SAR =</span>
                <input
                  type="number"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  className="w-16 px-1 py-0.5 font-bold border border-slate-300 rounded text-center text-slate-900"
                />
                <span>IDR</span>
              </div>
            </div>
          </div>

          {/* Rooms Table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">Room Breakdown ({rooms.length} items)</span>
              <button
                type="button"
                onClick={addRoom}
                className="flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Room</span>
              </button>
            </div>

            <div className="space-y-3">
              {rooms.map((room, idx) => {
                const roomCostTotal = room.numberOfRooms * room.costPerNight * totalNights;
                const roomSellTotal = room.numberOfRooms * room.sellPerNight * totalNights;
                const roomProfit = roomSellTotal - roomCostTotal;

                return (
                  <div key={room.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 flex items-center space-x-1">
                        <BedDouble className="w-4 h-4 text-emerald-600" />
                        <span>Room Item #{idx + 1}</span>
                      </span>
                      {rooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRoom(room.id)}
                          className="text-rose-600 hover:text-rose-800 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="lg:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Room Type <span className="text-slate-400">(auto-fill guest count)</span>
                        </label>
                        <select
                          value={room.roomType}
                          onChange={(e) => updateRoom(room.id, 'roomType', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                        >
                          {!ROOM_TYPES.some((t) => t.label === room.roomType) && (
                            <option value={room.roomType}>{room.roomType}</option>
                          )}
                          {ROOM_TYPES.map((t) => (
                            <option key={t.code} value={t.label}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Qty Rooms</label>
                        <input
                          type="number"
                          min="1"
                          value={room.numberOfRooms}
                          onChange={(e) => updateRoom(room.id, 'numberOfRooms', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Meal Plan</label>
                        <select
                          value={room.mealPlan}
                          onChange={(e) =>
                            updateRoom(
                              room.id,
                              'mealPlan',
                              e.target.value as RoomDetail['mealPlan']
                            )
                          }
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                        >
                          <option value="Room Only">Room Only</option>
                          <option value="Breakfast">Breakfast</option>
                          <option value="Half Board">Half Board</option>
                          <option value="Full Board">Full Board</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2 lg:col-span-1">
                        <div>
                          <label className="block text-[10px] font-semibold text-rose-700 mb-0.5">
                            HPP Buy / Night (SAR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={room.costPerNight}
                            onChange={(e) => updateRoom(room.id, 'costPerNight', Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-rose-300 rounded-lg font-bold text-rose-900 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-emerald-700 mb-0.5">
                            Sell / Night (SAR)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={room.sellPerNight}
                            onChange={(e) => updateRoom(room.id, 'sellPerNight', Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-emerald-300 rounded-lg font-bold text-emerald-900 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[11px] pt-2 border-t border-slate-200/80 font-medium text-slate-600">
                      <span>
                        Subtotal ({totalNights} nights): Sell = <strong>SAR {roomSellTotal.toLocaleString()}</strong> | HPP = SAR {roomCostTotal.toLocaleString()}
                      </span>
                      <span className="text-emerald-700 font-bold">
                        Profit: +SAR {roomProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== Size Group (Total Pax) — live capacity math ===== */}
          <div className="relative overflow-hidden rounded-xl bg-slate-900 text-white px-3.5 py-3 shadow-lg">
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 90% 10%, #10b981 0, transparent 45%), radial-gradient(circle at 10% 90%, #38bdf8 0, transparent 45%)' }}
            />
            <div className="relative flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Size Group (Total Pax)
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                {paxLines.map((l) => (
                  <span
                    key={l.id}
                    title={`${l.label} · kapasitas ${l.pax / Math.max(1, l.qty)} pax/kamar`}
                    className="inline-flex items-center gap-1 bg-slate-800/90 border border-slate-700 hover:border-emerald-500 hover:-translate-y-0.5 transition-all px-2 py-1 rounded-lg text-[10px] font-bold cursor-default"
                  >
                    <span className="text-sky-300">{l.qty}</span>
                    <span className="text-slate-400">{l.code}</span>
                    <span className="text-slate-500">=</span>
                    <span className="text-white">{l.pax} Pax</span>
                  </span>
                ))}
                {paxLines.length > 1 && <span className="text-slate-500 text-[10px] font-black">+</span>}
              </div>

              <span key={totalPax} className="ml-auto flex items-baseline gap-1.5 animate-[paxPop_.25s_ease-out]">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Guest =</span>
                <span className="text-2xl font-black text-emerald-400 leading-none">{totalPax}</span>
                <span className="text-[10px] font-black text-emerald-300">Pax</span>
              </span>
            </div>
            <style>{`@keyframes paxPop{0%{transform:scale(.85);opacity:.4}100%{transform:scale(1);opacity:1}}`}</style>
            <p className="relative text-[9px] text-slate-400 mt-1.5">
              Kapasitas otomatis: {ROOM_TYPES.map((t) => `${t.label} ${t.cap}`).join(' · ')} pax/kamar — Group Size Breakdown terisi otomatis & tetap bisa diedit.
            </p>
          </div>

          {/* Additional Services */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">Extra Services / Markups (Airport Transfers, Visas, Tours)</span>
              <button
                type="button"
                onClick={addService}
                className="flex items-center space-x-1 text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Extra Service</span>
              </button>
            </div>

            {additionalServices.length > 0 && (
              <div className="space-y-2">
                {additionalServices.map((service) => (
                  <div key={service.id} className="flex flex-col sm:flex-row items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <input
                      type="text"
                      value={service.description}
                      onChange={(e) => updateService(service.id, 'description', e.target.value)}
                      placeholder="e.g. VIP Private Transfer GMC"
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg font-medium text-slate-900 bg-white"
                    />
                    <div className="flex items-center space-x-2">
                      <div>
                        <span className="text-[9px] font-semibold text-rose-600 block">Cost ({inputCurrency})</span>
                        <input
                          type="number"
                          value={service.cost}
                          onChange={(e) => updateService(service.id, 'cost', Number(e.target.value))}
                          className="w-24 px-2 py-1 border border-rose-300 rounded-lg font-bold text-slate-900 bg-white"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-emerald-600 block">Sell ({inputCurrency})</span>
                        <input
                          type="number"
                          value={service.sell}
                          onChange={(e) => updateService(service.id, 'sell', Number(e.target.value))}
                          className="w-24 px-2 py-1 border border-emerald-300 rounded-lg font-bold text-slate-900 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeService(service.id)}
                        className="text-rose-600 hover:text-rose-800 p-1 self-end mb-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Payment Terms & Collections */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center space-x-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>5. Payment Details & Customer Collection</span>
          </h3>

          {/* Payment Mode Toggle: Single vs Tenor */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Payment Entry Mode:</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {paymentMode === 'tenor'
                  ? 'Record multiple installments (DP, tenor 1..n, pelunasan) with its own rate each'
                  : 'One single payment / deposit entry'}
              </span>
            </div>
            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setPaymentMode('single')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition-all ${
                  paymentMode === 'single'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                Single Payment
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode('tenor');
                  if (tenors.length === 0 && amountPaidInput > 0) {
                    setTenors([
                      {
                        id: `t-${Date.now()}`,
                        date: new Date().toISOString().slice(0, 10),
                        amount: amountPaidInput,
                        rate: paymentRate,
                        method: paymentMethod,
                        reference: 'DP',
                      },
                    ]);
                    setAmountPaidInput(0);
                  } else if (tenors.length === 0) {
                    addTenor();
                  }
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-1.5 rounded-lg transition-all ${
                  paymentMode === 'tenor'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <span>Tenor / Partial</span>
                {tenors.length > 0 && (
                  <span className="bg-white/25 text-[9px] px-1.5 py-0.5 rounded-full">{tenors.length}</span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {paymentMode === 'single' && (
              <>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Deposit / Amount Paid ({inputCurrency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={amountPaidInput}
                onChange={(e) => setAmountPaidInput(Number(e.target.value))}
                className="w-full px-3 py-2 border border-emerald-300 rounded-xl font-bold text-emerald-950 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Counter-currency column — auto exchange by KURS, rounded mathematically */}
            <div>
              <label className="block font-semibold text-teal-700 mb-1 flex items-center justify-between">
                <span>Jumlah Payment ({inputCurrency === 'SAR' ? 'IDR' : 'SAR'})</span>
                <span className="text-[8px] font-black bg-teal-100 text-teal-700 border border-teal-300 px-1.5 py-0.5 rounded">
                  AUTO EXCHANGE
                </span>
              </label>
              <div className="relative">
                {inputCurrency === 'SAR' ? (
                  <span className="absolute left-3 top-2 text-[11px] font-black text-teal-600">Rp</span>
                ) : (
                  <RiyalIcon className="w-4 h-4 text-amber-600 absolute left-3 top-2.5" />
                )}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={singleCounterValue}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (inputCurrency === 'SAR') {
                      setAmountPaidInput(paymentRate > 0 ? roundSAR(v / paymentRate) : 0);
                    } else {
                      setAmountPaidInput(roundIDR(v * (paymentRate || 0)));
                    }
                  }}
                  className="w-full pl-9 pr-3 py-2 border-2 border-teal-300 rounded-xl font-black text-teal-900 bg-teal-50/60 focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <p className="text-[10px] text-teal-700 font-bold mt-1">
                {inputCurrency === 'SAR'
                  ? `${(amountPaidInput || 0).toLocaleString('id-ID')} SAR × ${Number(paymentRate).toLocaleString('id-ID')} → dibulatkan terdekat`
                  : `Rp ${(amountPaidInput || 0).toLocaleString('id-ID')} ÷ ${Number(paymentRate).toLocaleString('id-ID')} → dibulatkan terdekat`}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Kurs Transaksi Pembayaran</span>
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                  LIVE RATE
                </span>
              </label>
              <div className="relative">
                <RiyalIcon className="w-4 h-4 text-amber-600 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min="1"
                  value={paymentRate}
                  onChange={(e) => setPaymentRate(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 border border-amber-300 rounded-xl font-bold text-slate-900 bg-amber-50/50 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">1 SAR = {Number(paymentRate).toLocaleString()} IDR saat transaksi</p>
            </div>
              </>
            )}

            {/* ===== TENOR / PARTIAL PAYMENT ENTRIES ===== */}
            {paymentMode === 'tenor' && (
              <div className="sm:col-span-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Installment Schedule — {tenors.length} transaksi
                  </span>
                  <button
                    type="button"
                    onClick={addTenor}
                    className="flex items-center space-x-1 text-xs font-bold text-orange-700 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Tenor</span>
                  </button>
                </div>

                {tenors.length === 0 && (
                  <p className="text-[11px] italic text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-3 text-center">
                    Belum ada transaksi pembayaran. Klik “Tambah Tenor” untuk mencatat DP / cicilan.
                  </p>
                )}

                {tenors.map((t, idx) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end bg-orange-50/60 dark:bg-slate-800/60 border border-orange-200 dark:border-slate-700 rounded-xl p-2.5"
                  >
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                      <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center shadow">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">TGL BAYAR</label>
                      <input
                        type="date"
                        value={t.date}
                        onChange={(e) => updateTenor(t.id, { date: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg text-[11px] font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-emerald-700 mb-0.5">JUMLAH ({inputCurrency})</label>
                      <input
                        type="number"
                        min="0"
                        value={t.amount}
                        onChange={(e) => updateTenor(t.id, { amount: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 border border-emerald-300 rounded-lg text-[11px] font-black text-emerald-950 dark:text-emerald-300 dark:bg-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-amber-700 mb-0.5">KURS TRX</label>
                      <input
                        type="number"
                        min="1"
                        value={t.rate}
                        onChange={(e) => updateTenor(t.id, { rate: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-[11px] font-bold dark:bg-slate-900"
                      />
                    </div>
                    {/* Counter-currency auto-exchange column */}
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-teal-700 mb-0.5">
                        {inputCurrency === 'SAR' ? 'IDR' : 'SAR'} (AUTO)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          inputCurrency === 'SAR'
                            ? roundIDR((t.amount || 0) * (t.rate || paymentRate))
                            : (t.rate || paymentRate) > 0
                              ? roundSAR((t.amount || 0) / (t.rate || paymentRate))
                              : 0
                        }
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const r = t.rate || paymentRate;
                          if (inputCurrency === 'SAR') updateTenor(t.id, { amount: r > 0 ? roundSAR(v / r) : 0 });
                          else updateTenor(t.id, { amount: roundIDR(v * (r || 0)) });
                        }}
                        className="w-full px-2 py-1.5 border-2 border-teal-300 rounded-lg text-[11px] font-black text-teal-800 dark:text-teal-300 bg-teal-50/60 dark:bg-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">METODE</label>
                      <select
                        value={t.method}
                        onChange={(e) => updateTenor(t.id, { method: e.target.value as PaymentMethod })}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg text-[10px]"
                      >
                        <option value="Bank Transfer (Al Rajhi)">Al Rajhi KSA</option>
                        <option value="Bank Transfer (BCA/Mandiri)">BCA / Mandiri</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Cash">Cash</option>
                        <option value="Credit/Invoice">Invoice</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">REF</label>
                      <input
                        type="text"
                        value={t.reference}
                        onChange={(e) => updateTenor(t.id, { reference: e.target.value })}
                        placeholder="TRX"
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-lg text-[10px] font-mono"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeTenor(t.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                        title="Hapus tenor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="col-span-2 sm:col-span-12 text-[10px] text-teal-700 font-semibold -mt-1">
                      = {inputCurrency === 'SAR'
                        ? `Rp ${roundIDR((t.amount || 0) * (t.rate || paymentRate)).toLocaleString('id-ID')}`
                        : `SAR ${roundSAR((t.rate || paymentRate) > 0 ? (t.amount || 0) / (t.rate || paymentRate) : 0).toLocaleString('id-ID')}`}{' '}
                      · pembulatan terdekat @ kurs {Number(t.rate).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}

                {tenors.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white rounded-xl px-3 py-2 text-[11px]">
                    <span className="font-bold text-slate-300">
                      Total Terbayar: <span className="text-emerald-400 font-black">{formatSAR(paidSAR)}</span>{' '}
                      <span className="text-slate-400">({formatIDR(paidIDR)})</span>
                    </span>
                    <span className={`font-black ${remSAR > 0.5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {remSAR > 0.5 ? `Sisa: ${formatSAR(remSAR)} (${formatIDR(remIDR)})` : '✓ LUNAS'}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
              >
                <option value="Bank Transfer (Al Rajhi)">Bank Transfer (Al Rajhi KSA)</option>
                <option value="Bank Transfer (BCA/Mandiri)">Bank Transfer (BCA/Mandiri Indo)</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cash">Cash</option>
                <option value="Credit/Invoice">Credit / B2B Invoice</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Reference / TRX ID</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="TRX-192830192"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
              />
            </div>

            <div className="sm:col-span-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-xs block">Remaining Customer Balance Due:</span>
                <span className={`text-lg font-black ${overpaidBill ? 'text-teal-600' : remSAR > 0.5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {overpaidBill ? 'Balance Deposit ' : ''}{formatSAR(Math.abs(remSAR))} ({formatIDR(Math.abs(remIDR))})
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    if (paymentMode === 'tenor') {
                      settleRemainingAsTenor();
                    } else {
                      if (inputCurrency === 'SAR') {
                        setAmountPaidInput(Math.round(totals.totalSellSAR * 100) / 100);
                      } else {
                        setAmountPaidInput(Math.round(totals.totalSellIDR));
                      }
                      setStatus('Paid');
                    }
                  }}
                  disabled={remSAR <= 0.5}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors"
                >
                  {paymentMode === 'tenor' ? 'Settle Remaining as Final Tenor' : 'Mark Full Payment Paid'}
                </button>
              </div>
            </div>

            {/* ===== VENDOR / HOTEL PAYMENTS (OUT) ===== */}
            <div className="sm:col-span-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                    Pembayaran ke Vendor / Hotel (HPP)
                  </span>
                  <p className="text-[10px] text-rose-600/80 dark:text-rose-400/70">
                    Termin pembayaran supplier dengan kurs transaksi tersendiri · data rahasia internal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addVendorPay}
                  className="flex items-center space-x-1 text-xs font-bold text-rose-700 bg-white dark:bg-slate-900 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pembayaran Vendor</span>
                </button>
              </div>

              {vendorPays.length === 0 ? (
                <p className="text-[11px] italic text-rose-400 text-center py-2">
                  Belum ada pembayaran ke vendor. Catat DP/pelunasan ke hotel di sini.
                </p>
              ) : (
                vendorPays.map((t, idx) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-xl p-2.5"
                  >
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                      <span className="w-7 h-7 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center shadow">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">TGL BAYAR</label>
                      <input
                        type="date"
                        value={t.date}
                        onChange={(e) => updateVendorPay(t.id, { date: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg text-[11px] font-semibold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-rose-700 mb-0.5">JUMLAH ({inputCurrency})</label>
                      <input
                        type="number"
                        min="0"
                        value={t.amount}
                        onChange={(e) => updateVendorPay(t.id, { amount: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 border border-rose-300 rounded-lg text-[11px] font-black text-rose-950 dark:text-rose-300 dark:bg-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-amber-700 mb-0.5">KURS TRX</label>
                      <input
                        type="number"
                        min="1"
                        value={t.rate}
                        onChange={(e) => updateVendorPay(t.id, { rate: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-[11px] font-bold dark:bg-slate-800"
                      />
                    </div>
                    {/* Counter-currency auto-exchange column */}
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-teal-700 mb-0.5">
                        {inputCurrency === 'SAR' ? 'IDR' : 'SAR'} (AUTO)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          inputCurrency === 'SAR'
                            ? roundIDR((t.amount || 0) * (t.rate || paymentRate))
                            : (t.rate || paymentRate) > 0
                              ? roundSAR((t.amount || 0) / (t.rate || paymentRate))
                              : 0
                        }
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const r = t.rate || paymentRate;
                          if (inputCurrency === 'SAR') updateVendorPay(t.id, { amount: r > 0 ? roundSAR(v / r) : 0 });
                          else updateVendorPay(t.id, { amount: roundIDR(v * (r || 0)) });
                        }}
                        className="w-full px-2 py-1.5 border-2 border-teal-300 rounded-lg text-[11px] font-black text-teal-800 dark:text-teal-300 bg-teal-50/60 dark:bg-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">METODE</label>
                      <select
                        value={t.method}
                        onChange={(e) => updateVendorPay(t.id, { method: e.target.value as PaymentMethod })}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg text-[10px]"
                      >
                        <option value="Bank Transfer (Al Rajhi)">Al Rajhi KSA</option>
                        <option value="Bank Transfer (BCA/Mandiri)">BCA / Mandiri</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Cash">Cash</option>
                        <option value="Credit/Invoice">Invoice</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[9px] font-bold text-slate-500 mb-0.5">REF</label>
                      <input
                        type="text"
                        value={t.reference}
                        onChange={(e) => updateVendorPay(t.id, { reference: e.target.value })}
                        placeholder="INV"
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg text-[10px] font-mono"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeVendorPay(t.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {vendorPays.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 text-white rounded-xl px-3 py-2 text-[11px]">
                  <span className="font-bold text-slate-300">
                    Total ke Vendor: <span className="text-rose-400 font-black">{formatSAR(vendorPaid.sar)}</span>{' '}
                    <span className="text-slate-400">({formatIDR(vendorPaid.idr)})</span>
                  </span>
                  <span className="font-black text-emerald-400">
                    Cash Position: {formatSAR(paidSAR - vendorPaid.sar)}
                  </span>
                </div>
              )}
            </div>

            {/* Payment History (when editing an existing booking in single mode) */}
            {paymentMode === 'single' && initialBooking && initialBooking.paymentHistory && initialBooking.paymentHistory.length > 0 && (
              <div className="sm:col-span-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <History className="w-4 h-4 text-orange-500" />
                  <span>Payment History ({initialBooking.paymentHistory.length} record(s))</span>
                </span>
                <div className="space-y-1">
                  {initialBooking.paymentHistory.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[11px]"
                    >
                      <span className="font-black text-orange-600">#{idx + 1}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {new Date(p.date).toLocaleDateString('en-GB')}
                      </span>
                      <span className="text-slate-500">{p.method}</span>
                      <span className="font-mono text-slate-400">{p.reference || '-'}</span>
                      <span className="font-bold text-emerald-700 flex items-center space-x-1">
                        <RiyalIcon className="w-3 h-3" />
                        <span>{formatSAR(p.amountSAR)}</span>
                      </span>
                      <span className="text-slate-500">{formatIDR(p.amountIDR)}</span>
                      {p.exchangeRate && (
                        <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded">
                          @{p.exchangeRate.toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sm:col-span-4">
              <label className="block font-semibold text-slate-700 mb-1">Special Internal Notes / Requests</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="High floor, Haram View requested, flower arrangement, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Action Submit Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-sm"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl shadow transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            <span>Save Record</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-900/30 transition-all text-sm"
          >
            <FileText className="w-4 h-4" />
            <span>Save & Generate Voucher</span>
          </button>
        </div>
      </form>
    </div>
  );
};
