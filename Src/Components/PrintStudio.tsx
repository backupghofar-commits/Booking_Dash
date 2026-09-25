import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, Printer, RotateCcw, X } from 'lucide-react';
import { Booking, CompanySettings } from '../types/booking';
import { exportSinglePagePDF, printSinglePageA4 } from '../utils/export';
import { VoucherDocument } from './VoucherDocument';

interface Props {
  booking: Booking;
  settings: CompanySettings;
  initialAction: 'pdf' | 'print';
  onClose: () => void;
}

export const PrintStudio: React.FC<Props> = ({ booking, settings, initialAction, onClose }) => {
  const [marginMm, setMarginMm] = useState(6);
  const [scalePercent, setScalePercent] = useState(100);
  const [busy, setBusy] = useState<'pdf' | 'print' | null>(null);
  const [message, setMessage] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [previewFit, setPreviewFit] = useState(0.6);
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const page = pageRef.current;
    const documentBox = documentRef.current;
    if (!page || !documentBox) return;
    const update = () => {
      const pageWidth = page.clientWidth;
      const pageHeight = page.clientHeight;
      const pxPerMm = pageWidth / 210;
      const marginPx = marginMm * pxPerMm;
      const documentWidth = 794;
      const documentHeight = documentBox.scrollHeight;
      const fit =
        Math.min(
          (pageWidth - marginPx * 2) / documentWidth,
          (pageHeight - marginPx * 2) / documentHeight
        ) *
        (scalePercent / 100);
      const renderedWidth = documentWidth * fit;
      const renderedHeight = documentHeight * fit;
      setPreviewFit(fit);
      setPreviewOffset({
        x: Math.max(marginPx, (pageWidth - renderedWidth) / 2),
        y: Math.max(marginPx, (pageHeight - renderedHeight) / 2),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(page);
    observer.observe(documentBox);
    return () => observer.disconnect();
  }, [marginMm, scalePercent, booking, settings]);

  const download = async () => {
    setBusy('pdf');
    setMessage('');
    await new Promise((resolve) => setTimeout(resolve, 100));
    const ok = await exportSinglePagePDF(
      'voucher-studio-export',
      `Confirmation_Letter_${booking.bookingRef}`,
      { marginMm, scalePercent }
    );
    setBusy(null);
    setMessage(ok ? 'PDF A4 portrait berhasil disimpan.' : 'Gagal membuat PDF. Silakan coba lagi.');
  };

  const print = async () => {
    setBusy('print');
    setMessage('');
    await new Promise((resolve) => setTimeout(resolve, 100));
    const ok = await printSinglePageA4('voucher-studio-export', {
      marginMm,
      scalePercent,
    });
    setBusy(null);
    setMessage(ok ? 'Print preview dibuka.' : 'Popup print diblokir browser. Izinkan popup lalu coba lagi.');
  };

  return (
    <>
    <div className="fixed inset-0 z-[90] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-6xl h-[96vh] bg-slate-100 dark:bg-slate-950 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-700 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 bg-slate-900 text-white px-4 py-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] font-black text-orange-400">
              Print / PDF Studio
            </p>
            <h3 className="font-black text-sm sm:text-base">
              Confirmation Letter · A4 Portrait · One Page
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            aria-label="Close print studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] flex-1 min-h-0">
          {/* Controls */}
          <aside className="bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 text-xs">
              <div>
                <label className="block font-black text-slate-700 dark:text-slate-200 mb-1">
                  Paper Size
                </label>
                <select
                  value="A4"
                  disabled
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold"
                >
                  <option>A4 · 210 × 297 mm</option>
                </select>
              </div>
              <div>
                <label className="block font-black text-slate-700 dark:text-slate-200 mb-1">
                  Orientation
                </label>
                <select
                  value="portrait"
                  disabled
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold"
                >
                  <option>Portrait · locked</option>
                </select>
              </div>
              <div>
                <label className="flex justify-between font-black text-slate-700 dark:text-slate-200 mb-1">
                  <span>Margin</span><span className="text-orange-600">{marginMm} mm</span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={marginMm}
                  onChange={(event) => setMarginMm(Number(event.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between font-black text-slate-700 dark:text-slate-200 mb-1">
                  <span>Document Scale</span><span className="text-emerald-600">{scalePercent}%</span>
                </label>
                <input
                  type="range"
                  min="75"
                  max="100"
                  step="1"
                  value={scalePercent}
                  onChange={(event) => setScalePercent(Number(event.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setMarginMm(6);
                setScalePercent(100);
              }}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Layout
            </button>

            <div className="mt-4 space-y-2">
              <button
                onClick={print}
                disabled={busy !== null}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-colors disabled:opacity-50 ${
                  initialAction === 'print'
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Print A4
              </button>
              <button
                onClick={download}
                disabled={busy !== null}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-colors disabled:opacity-50 ${
                  initialAction === 'pdf'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </button>
            </div>

            {message && (
              <p className="mt-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {message}
              </p>
            )}
            <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
              Preview dan hasil cetak menggunakan dokumen yang sama. Posisi kanan-kiri dipusatkan otomatis dan seluruh isi diskalakan agar tetap satu halaman.
            </p>
          </aside>

          {/* Page preview */}
          <div className="min-h-0 overflow-auto p-4 sm:p-6 bg-slate-300 dark:bg-slate-800">
            <div
              ref={pageRef}
              className="relative mx-auto bg-white shadow-2xl transition-all duration-200 w-full max-w-[560px] aspect-[210/297] overflow-hidden"
            >
              <div
                ref={documentRef}
                style={{
                  width: 794,
                  position: 'absolute',
                  left: previewOffset.x,
                  top: previewOffset.y,
                  transform: `scale(${previewFit})`,
                  transformOrigin: 'top left',
                }}
              >
                <VoucherDocument
                  documentId="voucher-studio-preview"
                  booking={booking}
                  settings={settings}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    {createPortal(
      <div
        className="fixed -left-[2400px] top-0 pointer-events-none bg-white"
        aria-hidden="true"
        style={{ width: 794, transform: 'none', contain: 'none' }}
      >
        <VoucherDocument
          documentId="voucher-studio-export"
          booking={booking}
          settings={settings}
        />
      </div>,
      document.body
    )}
    </>
  );
};

export default PrintStudio;