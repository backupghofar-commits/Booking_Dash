import React, { useMemo, useState } from 'react';
import {
  Building2,
  Boxes,
  CreditCard,
  Eye,
  FileText,
  History,
  Search,
  Trash2,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  Booking,
  Customer,
  PaymentRecord,
  ProductRecord,
  VendorRecord,
} from '../types/booking';

interface Props {
  vendors: VendorRecord[];
  products: ProductRecord[];
  clients: Customer[];
  bookings: Booking[];
  onVendorsChange: (records: VendorRecord[]) => void;
  onProductsChange: (records: ProductRecord[]) => void;
  onClientsChange: (records: Customer[]) => void;
}

type Tab = 'vendor' | 'product' | 'client';

const input =
  'w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white';

export const DirectoryManagement: React.FC<Props> = ({
  vendors,
  products,
  clients,
  bookings,
  onVendorsChange,
  onProductsChange,
  onClientsChange,
}) => {
  const [tab, setTab] = useState<Tab>('vendor');
  const [query, setQuery] = useState('');
  const [account, setAccount] = useState<
    | { type: 'vendor'; id: string }
    | { type: 'client'; id: string }
    | null
  >(null);

  const normalize = (value: string | undefined) =>
    (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const clientBookings = (client: Customer) => {
    const phone = normalize(client.phone);
    const identity = normalize(client.travelCompany || client.name);
    return bookings.filter((booking) => {
      const bookingIdentity = normalize(
        booking.bookingType === 'Group'
          ? booking.travelCompany || booking.customerName
          : booking.customerName
      );
      return (
        (phone !== '' && normalize(booking.customerPhone) === phone) ||
        (identity !== '' && bookingIdentity === identity)
      );
    });
  };

  const vendorBookings = (vendor: VendorRecord) =>
    bookings.filter(
      (booking) =>
        normalize(booking.vendorName) !== '' &&
        normalize(booking.vendorName) === normalize(vendor.name)
    );

  const customerPayments = (booking: Booking): PaymentRecord[] => {
    if (booking.paymentHistory?.length) return booking.paymentHistory;
    if (booking.amountPaidSAR <= 0 && booking.amountPaidIDR <= 0) return [];
    return [
      {
        id: `${booking.id}-summary`,
        date: booking.updatedAt || booking.createdAt,
        amountSAR: booking.amountPaidSAR,
        amountIDR: booking.amountPaidIDR,
        exchangeRate: booking.paymentExchangeRate || booking.exchangeRate,
        direction: 'customer',
        method: booking.paymentMethod,
        reference: booking.paymentReference,
        note: 'Recorded payment summary',
      },
    ];
  };

  const summarize = (records: Booking[], kind: 'vendor' | 'client') => {
    const orderSAR = records.reduce(
      (sum, booking) =>
        sum + (kind === 'vendor' ? booking.totalCostSAR : booking.totalSellSAR),
      0
    );
    const orderIDR = records.reduce(
      (sum, booking) =>
        sum + (kind === 'vendor' ? booking.totalCostIDR : booking.totalSellIDR),
      0
    );
    const transactions = records.flatMap((booking) =>
      (kind === 'vendor'
        ? booking.vendorPayments || []
        : customerPayments(booking)
      ).map((payment) => ({ booking, payment }))
    );
    const paidSAR = transactions.reduce((sum, item) => sum + item.payment.amountSAR, 0);
    const paidIDR = transactions.reduce((sum, item) => sum + item.payment.amountIDR, 0);
    const rawBalanceSAR = orderSAR - paidSAR;
    const rawBalanceIDR = orderIDR - paidIDR;
    return {
      orders: records.length,
      orderSAR,
      orderIDR,
      paidSAR,
      paidIDR,
      outstandingSAR: Math.max(0, rawBalanceSAR),
      outstandingIDR: Math.max(0, rawBalanceIDR),
      depositSAR: Math.max(0, -rawBalanceSAR),
      depositIDR: Math.max(0, -rawBalanceIDR),
      transactions: transactions.sort(
        (a, b) =>
          new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime()
      ),
    };
  };

  const formatSAR = (value: number) =>
    `SAR ${value.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const formatIDR = (value: number) => `IDR ${Math.round(value).toLocaleString('id-ID')}`;

  const filteredVendors = useMemo(
    () => vendors.filter((v) => `${v.name} ${v.pic} ${v.phone}`.toLowerCase().includes(query.toLowerCase())),
    [vendors, query]
  );
  const filteredProducts = useMemo(
    () => products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())),
    [products, query]
  );
  const filteredClients = useMemo(
    () => clients.filter((c) => `${c.name} ${c.travelCompany || ''} ${c.phone}`.toLowerCase().includes(query.toLowerCase())),
    [clients, query]
  );

  const addVendor = () =>
    onVendorsChange([
      {
        id: `v-${Date.now()}`,
        name: '',
        pic: '',
        phone: '',
        email: '',
        notes: '',
        active: true,
        updatedAt: new Date().toISOString(),
      },
      ...vendors,
    ]);

  const addProduct = () =>
    onProductsChange([
      {
        id: `p-${Date.now()}`,
        name: '',
        category: 'Room',
        unit: 'room/night',
        defaultCostSAR: 0,
        defaultSellSAR: 0,
        active: true,
        updatedAt: new Date().toISOString(),
      },
      ...products,
    ]);

  const addClient = () =>
    onClientsChange([
      {
        id: `c-${Date.now()}`,
        bookingType: 'Private',
        name: '',
        phone: '',
        email: '',
        passport: '',
        country: 'Indonesia',
        updatedAt: new Date().toISOString(),
      },
      ...clients,
    ]);

  const accountView: {
    type: 'vendor' | 'client';
    title: string;
    subtitle: string;
    records: Booking[];
    summary: ReturnType<typeof summarize>;
  } | null = (() => {
    if (!account) return null;
    if (account.type === 'vendor') {
      const vendor = vendors.find((item) => item.id === account.id);
      if (!vendor) return null;
      const records = vendorBookings(vendor);
      return {
        type: 'vendor',
        title: vendor.name || 'Unnamed Vendor',
        subtitle: [vendor.pic && `PIC ${vendor.pic}`, vendor.phone, vendor.email]
          .filter(Boolean)
          .join(' · '),
        records,
        summary: summarize(records, 'vendor'),
      };
    }
    const client = clients.find((item) => item.id === account.id);
    if (!client) return null;
    const records = clientBookings(client);
    return {
      type: 'client',
      title: client.travelCompany || client.name || 'Unnamed Client',
      subtitle: [
        client.bookingType,
        client.travelCompany && client.name ? `PIC ${client.name}` : '',
        client.phone,
        client.email,
      ]
        .filter(Boolean)
        .join(' · '),
      records,
      summary: summarize(records, 'client'),
    };
  })();

  return (
    <div className="space-y-5 pb-16">
      <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
            Master Data Directory
          </p>
          <h2 className="text-xl font-black">Vendor · Product · Client Management</h2>
          <p className="text-[11px] text-slate-400 mt-1">
            Data tersimpan lokal dan digunakan sebagai referensi operasional booking.
          </p>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
          {(
            [
              ['vendor', 'Vendor', Building2],
              ['product', 'Product', Boxes],
              ['client', 'Client', Users],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                tab === key ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3 justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${tab}...`}
              className={`${input} pl-9`}
            />
          </div>
          <button
            onClick={tab === 'vendor' ? addVendor : tab === 'product' ? addProduct : addClient}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs"
          >
            + Add {tab === 'vendor' ? 'Vendor' : tab === 'product' ? 'Product' : 'Client'}
          </button>
        </div>

        <div className="overflow-x-auto">
          {tab === 'vendor' && (
            <table className="w-full min-w-[1320px] text-xs">
              <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Vendor Name</th>
                  <th className="px-3 py-2 text-left">PIC Sales</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-center">Orders</th>
                  <th className="px-3 py-2 text-right">Total HPP</th>
                  <th className="px-3 py-2 text-right">Paid to Vendor</th>
                  <th className="px-3 py-2 text-right">Balance / Deposit</th>
                  <th className="px-3 py-2 text-center">Active</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVendors.map((vendor) => {
                  const summary = summarize(vendorBookings(vendor), 'vendor');
                  return (
                  <tr key={vendor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {(['name', 'pic', 'phone', 'email', 'notes'] as const).map((field) => (
                      <td key={field} className="px-2 py-2">
                        <input
                          value={vendor[field]}
                          onChange={(event) =>
                            onVendorsChange(
                              vendors.map((item) =>
                                item.id === vendor.id
                                  ? { ...item, [field]: event.target.value, updatedAt: new Date().toISOString() }
                                  : item
                              )
                            )
                          }
                          className={input}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex min-w-7 justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 font-black">
                        {summary.orders}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-black text-rose-700">
                      <p>{formatSAR(summary.orderSAR)}</p>
                      <p className="text-[9px] font-semibold text-slate-400">{formatIDR(summary.orderIDR)}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-black text-emerald-700">
                      <p>{formatSAR(summary.paidSAR)}</p>
                      <p className="text-[9px] font-semibold text-slate-400">{formatIDR(summary.paidIDR)}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-black">
                      {summary.depositSAR > 0 ? (
                        <>
                          <p className="text-teal-700">Deposit {formatSAR(summary.depositSAR)}</p>
                          <p className="text-[9px] font-semibold text-teal-600">{formatIDR(summary.depositIDR)}</p>
                        </>
                      ) : (
                        <>
                          <p className={summary.outstandingSAR > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {formatSAR(summary.outstandingSAR)}
                          </p>
                          <p className="text-[9px] font-semibold text-slate-400">{formatIDR(summary.outstandingIDR)}</p>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={vendor.active}
                        onChange={(event) =>
                          onVendorsChange(
                            vendors.map((item) =>
                              item.id === vendor.id ? { ...item, active: event.target.checked } : item
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => setAccount({ type: 'vendor', id: vendor.id })}
                        className="p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 rounded-lg"
                        title="Account statement"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => onVendorsChange(vendors.filter((item) => item.id !== vendor.id))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {tab === 'product' && (
            <table className="w-full min-w-[820px] text-xs">
              <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-right">Cost SAR</th>
                  <th className="px-3 py-2 text-right">Sell SAR</th>
                  <th className="px-3 py-2 text-center">Active</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-2 py-2">
                      <input value={product.name} onChange={(event) => onProductsChange(products.map((item) => item.id === product.id ? { ...item, name: event.target.value } : item))} className={input} />
                    </td>
                    <td className="px-2 py-2">
                      <select value={product.category} onChange={(event) => onProductsChange(products.map((item) => item.id === product.id ? { ...item, category: event.target.value as ProductRecord['category'] } : item))} className={input}>
                        {['Room', 'Service', 'Transport', 'Visa', 'Other'].map((value) => <option key={value}>{value}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2"><input value={product.unit} onChange={(event) => onProductsChange(products.map((item) => item.id === product.id ? { ...item, unit: event.target.value } : item))} className={input} /></td>
                    <td className="px-2 py-2"><input type="number" value={product.defaultCostSAR} onChange={(event) => onProductsChange(products.map((item) => item.id === product.id ? { ...item, defaultCostSAR: Number(event.target.value) } : item))} className={`${input} text-right`} /></td>
                    <td className="px-2 py-2"><input type="number" value={product.defaultSellSAR} onChange={(event) => onProductsChange(products.map((item) => item.id === product.id ? { ...item, defaultSellSAR: Number(event.target.value) } : item))} className={`${input} text-right`} /></td>
                    <td className="px-2 py-2 text-center"><input type="checkbox" checked={product.active} onChange={(event) => onProductsChange(products.map((item) => item.id === product.id ? { ...item, active: event.target.checked } : item))} /></td>
                    <td className="px-2 py-2"><button onClick={() => onProductsChange(products.filter((item) => item.id !== product.id))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'client' && (
            <table className="w-full min-w-[1380px] text-xs">
              <thead className="bg-slate-900 text-white text-[9px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Name / PIC</th>
                  <th className="px-3 py-2 text-left">Travel Company</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Country</th>
                  <th className="px-3 py-2 text-center">Orders</th>
                  <th className="px-3 py-2 text-right">Total Spending</th>
                  <th className="px-3 py-2 text-right">Total Payment</th>
                  <th className="px-3 py-2 text-right">Balance / Deposit</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredClients.map((client) => {
                  const summary = summarize(clientBookings(client), 'client');
                  return (
                  <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-2 py-2">
                      <select value={client.bookingType} onChange={(event) => onClientsChange(clients.map((item) => item.id === client.id ? { ...item, bookingType: event.target.value as Customer['bookingType'] } : item))} className={input}>
                        <option>Private</option><option>Group</option>
                      </select>
                    </td>
                    {(['name', 'travelCompany', 'phone', 'email', 'country'] as const).map((field) => (
                      <td key={field} className="px-2 py-2">
                        <input value={client[field] || ''} onChange={(event) => onClientsChange(clients.map((item) => item.id === client.id ? { ...item, [field]: event.target.value, updatedAt: new Date().toISOString() } : item))} className={input} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex min-w-7 justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 font-black">
                        {summary.orders}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-black text-slate-800 dark:text-slate-100">
                      <p>{formatSAR(summary.orderSAR)}</p>
                      <p className="text-[9px] font-semibold text-slate-400">{formatIDR(summary.orderIDR)}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-black text-emerald-700">
                      <p>{formatSAR(summary.paidSAR)}</p>
                      <p className="text-[9px] font-semibold text-slate-400">{formatIDR(summary.paidIDR)}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-black">
                      {summary.depositSAR > 0 ? (
                        <>
                          <p className="text-teal-700">Deposit {formatSAR(summary.depositSAR)}</p>
                          <p className="text-[9px] font-semibold text-teal-600">{formatIDR(summary.depositIDR)}</p>
                        </>
                      ) : (
                        <>
                          <p className={summary.outstandingSAR > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {formatSAR(summary.outstandingSAR)}
                          </p>
                          <p className="text-[9px] font-semibold text-slate-400">{formatIDR(summary.outstandingIDR)}</p>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => setAccount({ type: 'client', id: client.id })}
                        className="p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 rounded-lg"
                        title="Account statement"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => onClientsChange(clients.filter((item) => item.id !== client.id))} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1.5">
          <UserRound className="w-3 h-3" /> Changes save automatically in the browser.
        </div>
      </div>

      {/* Vendor / Client account statement drawer */}
      {accountView && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <button
            aria-label="Close account statement"
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm cursor-default"
            onClick={() => setAccount(null)}
          />
          <aside className="relative w-full max-w-3xl h-full bg-slate-100 dark:bg-slate-950 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 bg-slate-900 text-white px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
                  {accountView.type === 'vendor' ? 'Vendor Account' : 'Client Account'}
                </p>
                <h3 className="text-lg font-black">{accountView.title}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{accountView.subtitle || 'No contact details'}</p>
              </div>
              <button
                onClick={() => setAccount(null)}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-5">
              {/* Account accumulation */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                  <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                    <FileText className="w-3 h-3" /> Total Pesanan
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {accountView.summary.orders}
                  </p>
                  <p className="text-[9px] text-slate-400">booking / invoice</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-3">
                  <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-500">
                    <Wallet className="w-3 h-3" />
                    {accountView.type === 'vendor' ? 'Total HPP / Spending' : 'Total Spending'}
                  </p>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-1">
                    {formatSAR(accountView.summary.orderSAR)}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400">
                    {formatIDR(accountView.summary.orderIDR)}
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-400 dark:border-emerald-800 rounded-xl p-3">
                  <p className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <CreditCard className="w-3 h-3" /> Total Payment
                  </p>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {formatSAR(accountView.summary.paidSAR)}
                  </p>
                  <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatIDR(accountView.summary.paidIDR)}
                  </p>
                </div>
                <div
                  className={`border-2 rounded-xl p-3 ${
                    accountView.summary.depositSAR > 0
                      ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-400 dark:border-teal-800'
                      : accountView.summary.outstandingSAR > 0
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-400 dark:border-rose-800'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-800'
                  }`}
                >
                  <p className="text-[8px] font-black uppercase tracking-wider text-slate-500">
                    {accountView.summary.depositSAR > 0 ? 'Amount Saldo / Deposit' : 'Balance Outstanding'}
                  </p>
                  <p
                    className={`text-sm font-black mt-1 ${
                      accountView.summary.depositSAR > 0
                        ? 'text-teal-700 dark:text-teal-300'
                        : accountView.summary.outstandingSAR > 0
                          ? 'text-rose-700 dark:text-rose-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {formatSAR(
                      accountView.summary.depositSAR > 0
                        ? accountView.summary.depositSAR
                        : accountView.summary.outstandingSAR
                    )}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400">
                    {formatIDR(
                      accountView.summary.depositIDR > 0
                        ? accountView.summary.depositIDR
                        : accountView.summary.outstandingIDR
                    )}
                  </p>
                </div>
              </div>

              {/* Orders */}
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-orange-500" /> Akumulasi Pesanan
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-[10.5px]">
                    <thead className="bg-slate-900 text-white text-[8.5px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left">Invoice</th>
                        <th className="px-3 py-2 text-left">Hotel / Client</th>
                        <th className="px-3 py-2 text-left">Stay</th>
                        <th className="px-3 py-2 text-right">Order</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {accountView.records.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                            Belum ada pesanan untuk akun ini.
                          </td>
                        </tr>
                      )}
                      {accountView.records.map((booking) => {
                        const payments =
                          accountView.type === 'vendor'
                            ? booking.vendorPayments || []
                            : customerPayments(booking);
                        const paidSAR = payments.reduce(
                          (sum, payment) => sum + payment.amountSAR,
                          0
                        );
                        const orderSAR =
                          accountView.type === 'vendor'
                            ? booking.totalCostSAR
                            : booking.totalSellSAR;
                        const balance = orderSAR - paidSAR;
                        return (
                          <tr key={booking.id}>
                            <td className="px-3 py-2 font-mono font-bold text-orange-600">
                              {booking.bookingRef}
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">
                              {accountView.type === 'vendor'
                                ? booking.travelCompany || booking.customerName
                                : booking.hotelName}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {booking.checkInDate} → {booking.checkOutDate}
                            </td>
                            <td className="px-3 py-2 text-right font-bold">
                              {formatSAR(orderSAR)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">
                              {formatSAR(paidSAR)}
                            </td>
                            <td className={`px-3 py-2 text-right font-black ${balance > 0 ? 'text-rose-600' : balance < 0 ? 'text-teal-600' : 'text-emerald-600'}`}>
                              {balance < 0 ? `Deposit ${formatSAR(Math.abs(balance))}` : formatSAR(balance)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-black text-[8px]">
                                {booking.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Transaction history */}
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-500" /> History Transaksi
                  </h4>
                  <span className="text-[9px] font-bold text-slate-400">
                    {accountView.summary.transactions.length} transaksi
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-[10.5px]">
                    <thead className="bg-slate-900 text-white text-[8.5px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left">Tanggal</th>
                        <th className="px-3 py-2 text-left">Invoice</th>
                        <th className="px-3 py-2 text-left">Metode</th>
                        <th className="px-3 py-2 text-left">Referensi</th>
                        <th className="px-3 py-2 text-right">Kurs</th>
                        <th className="px-3 py-2 text-right">SAR</th>
                        <th className="px-3 py-2 text-right">IDR</th>
                        <th className="px-3 py-2 text-left">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {accountView.summary.transactions.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                            Belum ada transaksi tercatat.
                          </td>
                        </tr>
                      )}
                      {accountView.summary.transactions.map(({ booking, payment }) => (
                        <tr key={`${booking.id}-${payment.id}`}>
                          <td className="px-3 py-2">
                            {new Date(payment.date).toLocaleDateString('id-ID')}
                          </td>
                          <td className="px-3 py-2 font-mono text-orange-600 font-bold">
                            {booking.bookingRef}
                          </td>
                          <td className="px-3 py-2">{payment.method}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">
                            {payment.reference || '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {payment.exchangeRate?.toLocaleString('id-ID') || '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {formatSAR(payment.amountSAR).replace('SAR ', '')}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">
                            {formatIDR(payment.amountIDR).replace('IDR ', '')}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{payment.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default DirectoryManagement;