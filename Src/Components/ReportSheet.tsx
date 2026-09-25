import React from 'react';
import { ShieldCheck, Users, Lock } from 'lucide-react';
import { Booking, CompanySettings } from '../types/booking';
import { averageTransactionRate } from '../utils/exchangeRate';

export interface ReportMeta {
  fromDate: string;
  toDate: string;
  hotelFilter: string;
  statusFilter: string;
}

interface ReportSheetProps {
  type: 'customer' | 'finance';
  bookings: Booking[];
  settings: CompanySettings;
  meta: ReportMeta;
  id: string;
}

const idNum = (n: number, d = 0) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0);

const statusBadge: Record<string, React.CSSProperties> = {
  Paid: { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
  Partial: { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  Unpaid: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  Draft: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' },
  Cancelled: { background: '#e5e7eb', color: '#4b5563', border: '1px solid #9ca3af' },
};

const badgeBase: React.CSSProperties = {
  padding: '1px 6px',
  borderRadius: 8,
  fontWeight: 800,
  fontSize: 7.5,
};

/**
 * Off-screen landscape A4 sheet (1122px ≈ A4 landscape @96dpi).
 * Rendered hidden and captured by html2canvas for single-page PDF export.
 */
export const ReportSheet: React.FC<ReportSheetProps> = ({ type, bookings, settings, meta, id }) => {
  const isFinance = type === 'finance';

  const totals = bookings.reduce(
    (acc, b) => {
      acc.costSAR += b.totalCostSAR;
      acc.sellSAR += b.totalSellSAR;
      acc.profitSAR += b.profitSAR;
      acc.paidSAR += b.amountPaidSAR;
      acc.balanceSAR += b.totalSellSAR - b.amountPaidSAR;
      acc.sellIDR += b.totalSellIDR;
      acc.paidIDR += b.amountPaidIDR;
      acc.balanceIDR += b.totalSellIDR - b.amountPaidIDR;
      acc.vendorSAR += (b.vendorPayments || []).reduce((s, p) => s + p.amountSAR, 0);
      return acc;
    },
    { costSAR: 0, sellSAR: 0, profitSAR: 0, paidSAR: 0, balanceSAR: 0, sellIDR: 0, paidIDR: 0, balanceIDR: 0, vendorSAR: 0 }
  );
  const margin = totals.sellSAR > 0 ? (totals.profitSAR / totals.sellSAR) * 100 : 0;
  const averageRate = averageTransactionRate(
    bookings.flatMap((booking) => booking.paymentHistory || []),
    settings.defaultExchangeRateSARtoIDR
  );
  const rateForBooking = (booking: Booking) =>
    averageTransactionRate(
      booking.paymentHistory,
      booking.exchangeRate || settings.defaultExchangeRateSARtoIDR
    );

  const th: React.CSSProperties = {
    background: '#0f172a',
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: 800,
    letterSpacing: 0.6,
    padding: '6px 7px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    fontSize: 9,
    padding: '5px 7px',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
  };
  const right: React.CSSProperties = { textAlign: 'right' };

  return (
    <div
      id={id}
      style={{
        position: 'fixed',
        left: -1400,
        top: 0,
        width: 1122,
        background: '#ffffff',
        color: '#0f172a',
        fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
        padding: 22,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* Centered gradient company-logo watermark */}
      {settings.logoUrl && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        >
          <img
            src={settings.logoUrl}
            alt=""
            style={{
              width: 480,
              maxWidth: '60%',
              opacity: 0.07,
              maskImage: 'radial-gradient(circle at center, black 15%, transparent 72%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 15%, transparent 72%)',
            }}
          />
        </div>
      )}
      {/* ===== Letterhead ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #f97316', paddingBottom: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="logo" style={{ height: 46, maxWidth: 140, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 44, height: 44, background: '#f97316', color: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>
              T
            </div>
          )}
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: '#ea580c', textTransform: 'uppercase' }}>
              {isFinance ? 'Internal Company Report' : 'Customer Billing Report'}
            </div>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#0f172a' }}>
              {settings.legalEntityName || settings.companyName}
            </div>
            <div style={{ fontSize: 9, fontStyle: 'italic', color: '#64748b' }}>{settings.tagline}</div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              display: 'inline-block',
              background: isFinance ? '#0f172a' : '#f97316',
              color: '#fff',
              padding: '7px 16px',
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: 1,
            }}
          >
            {isFinance ? 'FINANCE REPORT' : 'CUSTOMER REPORT'}
          </div>
          {isFinance && (
            <div style={{ marginTop: 4 }}>
              <span style={{ display: 'inline-block', border: '2px solid #dc2626', color: '#dc2626', fontWeight: 900, fontSize: 8.5, letterSpacing: 2, padding: '2px 8px', transform: 'rotate(-3deg)' }}>
                CONFIDENTIAL — INTERNAL USE ONLY
              </span>
            </div>
          )}
          <div style={{ fontSize: 8.5, color: '#475569', marginTop: 5 }}>
            Generated: <b>{new Date().toLocaleString('en-GB')}</b>
            <br />
            Period: <b>{meta.fromDate || '—'} → {meta.toDate || 'All'}</b> · Hotel: <b>{meta.hotelFilter === 'ALL' ? 'All' : meta.hotelFilter}</b> · Status: <b>{meta.statusFilter === 'ALL' ? 'All' : meta.statusFilter}</b>
          </div>
        </div>
      </div>

      {/* ===== Finance KPI strip ===== */}
      {isFinance && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, margin: '10px 0' }}>
          {[
            { label: 'BOOKINGS', value: String(bookings.length), color: '#0f172a', bg: '#f1f5f9', border: '#cbd5e1' },
            { label: 'SUPPLIER COST', value: `SAR ${idNum(totals.costSAR)}`, color: '#475569', bg: '#f8fafc', border: '#cbd5e1' },
            { label: 'REVENUE', value: `SAR ${idNum(totals.sellSAR)}`, color: '#0f172a', bg: '#fff7ed', border: '#fdba74' },
            { label: 'NET PROFIT', value: `SAR ${idNum(totals.profitSAR)}`, color: '#047857', bg: '#ecfdf5', border: '#6ee7b7' },
            { label: 'AVG MARGIN', value: `${margin.toFixed(1)}%`, color: '#ea580c', bg: '#fff7ed', border: '#fdba74' },
            { label: 'CUSTOMER PAID', value: `SAR ${idNum(totals.paidSAR)}`, color: '#047857', bg: '#ecfdf5', border: '#6ee7b7' },
            { label: 'VENDOR PAID', value: `SAR ${idNum(totals.vendorSAR)}`, color: '#be123c', bg: '#fef2f2', border: '#fca5a5' },
            { label: 'CASH POSITION', value: `SAR ${idNum(totals.paidSAR - totals.vendorSAR)}`, color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
          ].map((k) => (
            <div key={k.label} style={{ background: k.bg, border: `2px solid ${k.border}`, padding: '7px 10px', borderRadius: 4 }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1, color: '#64748b' }}>{k.label}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ===== Detail Table ===== */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginTop: isFinance ? 0 : 12 }}>
        <thead>
          <tr>
            {isFinance ? (
              <>
                <th style={th}>NO</th>
                <th style={th}>DATE</th>
                <th style={th}>INV REF</th>
                <th style={th}>CUSTOMER</th>
                <th style={th}>HOTEL</th>
                <th style={{ ...th, textAlign: 'center' }}>NIGHTS</th>
                <th style={{ ...th, ...right }}>COST (SAR)</th>
                <th style={{ ...th, ...right }}>SELL (SAR)</th>
                <th style={{ ...th, ...right }}>PROFIT (SAR)</th>
                <th style={{ ...th, textAlign: 'center' }}>MARGIN</th>
                <th style={{ ...th, ...right }}>CUST. PAID</th>
                <th style={{ ...th, ...right, color: '#fca5a5' }}>VENDOR PAID</th>
                <th style={{ ...th, ...right }}>BALANCE (SAR)</th>
                <th style={{ ...th, ...right }}>PROFIT (IDR)</th>
                <th style={th}>METHOD</th>
                <th style={th}>STAFF</th>
                <th style={{ ...th, textAlign: 'center' }}>STATUS</th>
              </>
            ) : (
              <>
                <th style={th}>NO</th>
                <th style={th}>INV REF</th>
                <th style={th}>CUSTOMER</th>
                <th style={th}>PHONE / WA</th>
                <th style={th}>HOTEL</th>
                <th style={th}>CHECK-IN</th>
                <th style={th}>CHECK-OUT</th>
                <th style={{ ...th, textAlign: 'center' }}>NIGHTS</th>
                <th style={{ ...th, ...right }}>TOTAL (SAR)</th>
                <th style={{ ...th, ...right }}>AVG RATE (IDR/SAR)</th>
                <th style={{ ...th, ...right }}>PAID (SAR)</th>
                <th style={{ ...th, textAlign: 'center' }}>TERMIN</th>
                <th style={{ ...th, ...right }}>BALANCE (SAR)</th>
                <th style={th}>DUE DATE</th>
                <th style={{ ...th, textAlign: 'center' }}>STATUS</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 && (
            <tr>
              <td colSpan={isFinance ? 17 : 15} style={{ ...td, textAlign: 'center', padding: 18, color: '#94a3b8' }}>
                No records for the selected filters.
              </td>
            </tr>
          )}
          {bookings.map((b, i) =>
            isFinance ? (
              <tr key={b.id} style={{ background: i % 2 ? '#f8fafc' : '#ffffff' }}>
                <td style={td}>{i + 1}</td>
                <td style={td}>{new Date(b.createdAt).toLocaleDateString('en-GB')}</td>
                <td style={{ ...td, fontWeight: 800, color: '#ea580c' }}>{b.bookingRef}</td>
                <td style={{ ...td, fontWeight: 700 }}>{b.customerName}</td>
                <td style={td}>{b.hotelName}</td>
                <td style={{ ...td, textAlign: 'center' }}>{b.totalNights}</td>
                <td style={{ ...td, ...right, color: '#64748b' }}>{idNum(b.totalCostSAR)}</td>
                <td style={{ ...td, ...right, fontWeight: 700 }}>{idNum(b.totalSellSAR)}</td>
                <td style={{ ...td, ...right, fontWeight: 800, color: '#047857' }}>{idNum(b.profitSAR)}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ background: b.profitMarginPercent >= 15 ? '#d1fae5' : b.profitMarginPercent >= 5 ? '#fef3c7' : '#fee2e2', color: b.profitMarginPercent >= 15 ? '#065f46' : b.profitMarginPercent >= 5 ? '#92400e' : '#991b1b', padding: '1px 5px', borderRadius: 8, fontWeight: 800, fontSize: 8 }}>
                    {b.profitMarginPercent.toFixed(1)}%
                  </span>
                </td>
                <td style={{ ...td, ...right, color: '#047857', fontWeight: 700 }}>{idNum(b.amountPaidSAR)}</td>
                <td style={{ ...td, ...right, color: '#be123c', fontWeight: 700 }}>
                  {idNum((b.vendorPayments || []).reduce((s, p) => s + p.amountSAR, 0))}
                </td>
                <td style={{ ...td, ...right, fontWeight: 800, color: b.totalSellSAR - b.amountPaidSAR > 0 ? '#dc2626' : '#94a3b8' }}>
                  {idNum(b.totalSellSAR - b.amountPaidSAR)}
                </td>
                <td style={{ ...td, ...right, color: '#047857' }}>{idNum(b.profitIDR)}</td>
                <td style={{ ...td, fontSize: 8 }}>{b.paymentMethod}</td>
                <td style={{ ...td, fontSize: 8.5 }}>{b.staffName}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ ...badgeBase, ...(statusBadge[b.status] || statusBadge.Draft) }}>
                    {b.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ) : (
              <tr key={b.id} style={{ background: i % 2 ? '#f8fafc' : '#ffffff' }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 800, color: '#ea580c' }}>{b.bookingRef}</td>
                <td style={{ ...td, fontWeight: 700 }}>{b.customerName}</td>
                <td style={td}>{b.customerPhone}</td>
                <td style={td}>{b.hotelName}</td>
                <td style={td}>{b.checkInDate}</td>
                <td style={td}>{b.checkOutDate}</td>
                <td style={{ ...td, textAlign: 'center' }}>{b.totalNights}</td>
                <td style={{ ...td, ...right, fontWeight: 700 }}>{idNum(b.totalSellSAR)}</td>
                <td style={{ ...td, ...right, fontWeight: 700 }}>{idNum(rateForBooking(b), 2)}</td>
                <td style={{ ...td, ...right, color: '#047857', fontWeight: 700 }}>{idNum(b.amountPaidSAR)}</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: '#b45309' }}>
                  {(b.paymentHistory || []).length || (b.amountPaidSAR > 0 ? 1 : 0)}x
                </td>
                <td style={{ ...td, ...right, fontWeight: 800, color: b.totalSellSAR - b.amountPaidSAR > 0 ? '#dc2626' : '#94a3b8' }}>
                  {idNum(b.totalSellSAR - b.amountPaidSAR)}
                </td>
                <td style={td}>{b.dueDate || '-'}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ ...badgeBase, ...(statusBadge[b.status] || statusBadge.Draft) }}>
                    {b.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            )
          )}
        </tbody>
        {bookings.length > 0 && (
          <tfoot>
            <tr style={{ background: '#f97316', color: '#ffffff', fontWeight: 900, fontSize: 12 }}>
              {isFinance ? (
                <>
                  <td colSpan={6} style={{ padding: '6px 7px' }}>TOTAL — {bookings.length} BOOKING(S)</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.costSAR)}</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.sellSAR)}</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.profitSAR)}</td>
                  <td style={{ textAlign: 'center', padding: '6px 7px' }}>{margin.toFixed(1)}%</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.paidSAR)}</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.vendorSAR)}</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.balanceSAR)}</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(bookings.reduce((s, b) => s + b.profitIDR, 0))}</td>
                  <td colSpan={3} style={{ padding: '6px 7px' }}></td>
                </>
              ) : (
                <>
                  <td colSpan={8} style={{ padding: '6px 7px' }}>TOTAL — {bookings.length} BOOKING(S)</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.sellSAR)}</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(averageRate, 2)}</td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.paidSAR)}</td>
                  <td style={{ textAlign: 'center', padding: '6px 7px' }}>
                    {bookings.reduce((s, b) => s + ((b.paymentHistory || []).length || (b.amountPaidSAR > 0 ? 1 : 0)), 0)}x
                  </td>
                  <td style={{ ...right, padding: '6px 7px' }}>{idNum(totals.balanceSAR)}</td>
                  <td colSpan={2} style={{ padding: '6px 7px' }}></td>
                </>
              )}
            </tr>
            <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: 700, fontSize: 10 }}>
              {isFinance ? (
                <>
                  <td colSpan={6} style={{ padding: '5px 7px', letterSpacing: 1 }}>EQUIVALENT IDR (RATE {idNum(settings.defaultExchangeRateSARtoIDR)})</td>
                  <td colSpan={11} style={{ ...right, padding: '5px 7px', fontFamily: 'monospace' }}>
                    Revenue {idNum(totals.sellIDR)} · Collected {idNum(totals.paidIDR)} · Vendor {idNum(totals.vendorSAR)} · Outstanding {idNum(totals.balanceIDR)}
                  </td>
                </>
              ) : (
                <>
                  <td colSpan={8} style={{ padding: '5px 7px', letterSpacing: 1 }}>AVERAGE EXCHANGE RATE — 1 SAR = {idNum(averageRate, 2)} IDR</td>
                  <td colSpan={7} style={{ ...right, padding: '5px 7px', fontFamily: 'monospace' }}>
                    Total SAR {idNum(totals.sellSAR)} · Paid SAR {idNum(totals.paidSAR)} · Balance SAR {idNum(totals.balanceSAR)}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        )}
      </table>

      {!isFinance && (
        <div style={{ marginTop: 7, padding: '5px 8px', background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: 8.5, fontWeight: 700 }}>
          CATATAN KURS: Dokumen customer mencantumkan balance dalam SAR. Nilai average rate berasal dari weighted average seluruh riwayat transaksi invoice dan menyesuaikan kurs yang berlaku saat transaksi dilakukan.
        </div>
      )}

      {/* ===== Footer ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
        <div style={{ fontSize: 8.5, color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 800, color: '#0f172a' }}>
            {isFinance ? <Lock size={11} /> : <Users size={11} />}
            {isFinance ? 'Prepared by Finance Division' : 'Prepared by Customer Service'}
          </div>
          <div style={{ marginTop: 2 }}>
            {isFinance
              ? `Authorized: ${settings.defaultStaffName || 'Finance Officer'} · Contains confidential supplier cost & profit data.`
              : `Authorized: ${settings.bookingManagerName || settings.defaultStaffName || 'Booking Manager'} · ${settings.bookingManagerRole || 'Booking Manager'}`}
          </div>
          <div style={{ fontStyle: 'italic', color: '#94a3b8', marginTop: 2 }}>
            System-generated report · {settings.waPhone || settings.phone}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 8.5, color: '#64748b' }}>Authorized Signature,</div>
          {settings.stampUrl ? (
            <img
              src={settings.stampUrl}
              alt="stamp"
              style={{ width: 88, height: 88, margin: '2px auto', objectFit: 'contain', opacity: 0.92, transform: 'rotate(-6deg)' }}
            />
          ) : (
            <div style={{ width: 72, height: 72, margin: '4px auto', borderRadius: '50%', border: '2.5px solid #94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', transform: 'rotate(-8deg)' }}>
              <ShieldCheck size={18} />
              <span style={{ fontSize: 6.5, fontWeight: 900, letterSpacing: 1.5 }}>TAMIMA</span>
            </div>
          )}
          <div style={{ fontSize: 9.5, fontWeight: 900 }}>( {(isFinance ? settings.defaultStaffName : settings.bookingManagerName || 'GHOFAR').toUpperCase()} )</div>
        </div>
      </div>

      <div style={{ background: '#0f172a', color: '#ffffff', textAlign: 'center', fontSize: 8, fontWeight: 800, letterSpacing: 1.5, padding: '6px 0', marginTop: 12, marginLeft: -22, marginRight: -22, marginBottom: -22 }}>
        {(settings.legalEntityName || settings.companyName).toUpperCase()} · {isFinance ? 'INTERNAL FINANCE REPORT' : 'CUSTOMER BOOKING REPORT'} · A4 LANDSCAPE · {bookings.length} RECORD(S)
      </div>
    </div>
  );
};

export default ReportSheet;
