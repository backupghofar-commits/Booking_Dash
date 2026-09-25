import React, { useState } from 'react';
import {
  Printer,
  FileSpreadsheet,
  MessageCircle,
  ArrowLeft,
  Edit3,
  Mail,
} from 'lucide-react';
import { Booking, CompanySettings } from '../types/booking';
import { VoucherDocument } from './VoucherDocument';
import { PrintStudio } from './PrintStudio';
import {
  exportStatementBookingCustomer,
  shareViaWhatsApp,
  shareViaEmail,
} from '../utils/export';

interface ConfirmationLetterProps {
  booking: Booking;
  settings: CompanySettings;
  onBack: () => void;
  onEdit?: () => void;
}

export const ConfirmationLetter: React.FC<ConfirmationLetterProps> = ({
  booking,
  settings,
  onBack,
  onEdit,
}) => {
  const [studioAction, setStudioAction] = useState<'pdf' | 'print' | null>(null);

  const btn =
    'flex items-center space-x-1.5 font-bold px-3 py-2 rounded-xl text-xs transition-colors shadow-sm';

  return (
    <div className="max-w-[880px] mx-auto space-y-4 pb-20">
      {/* Toolbar (hidden on print) */}
      <div className="print:hidden bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-4 shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-16 z-30">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest block">
              Confirmation Letter
            </span>
            <h2 className="text-lg font-extrabold font-mono tracking-wide">Invoice Ref: {booking.bookingRef}</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStudioAction('print')}
            className={`${btn} bg-orange-500 hover:bg-orange-600 text-white`}
            title="Print portrait A4 one page"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            onClick={() => setStudioAction('pdf')}
            className={`${btn} border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 transition-all`}
          >
            <FileSpreadsheet className="w-4 h-4 text-orange-400" />
            <span>PDF Studio</span>
          </button>

          <button
            onClick={() =>
              exportStatementBookingCustomer(
                [booking],
                settings,
                `Customer_Statement_${booking.bookingRef}`
              )
            }
            className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => shareViaWhatsApp(booking, settings)}
            className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => shareViaEmail(booking, settings)}
            className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`}
          >
            <Mail className="w-4 h-4 text-sky-400" />
            <span>Email</span>
          </button>

          {onEdit && (
            <button
              onClick={onEdit}
              className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700`}
            >
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* The printable document — horizontally scrollable on narrow screens */}
      <div className="cl-screen-voucher overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        <VoucherDocument booking={booking} settings={settings} />
      </div>

      {studioAction && (
        <PrintStudio
          booking={booking}
          settings={settings}
          initialAction={studioAction}
          onClose={() => setStudioAction(null)}
        />
      )}
    </div>
  );
};

export default ConfirmationLetter;
