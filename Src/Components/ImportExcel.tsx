import React, { useMemo, useRef, useState } from 'react';
import {
  FileUp, Download, ArrowLeft, CheckCircle2, Database, Loader2, ShieldAlert,
  RefreshCw, FileSpreadsheet, X, ShieldCheck, FileWarning, FileText, ScrollText,
} from 'lucide-react';
import { Booking, CompanySettings } from '../types/booking';
import {
  readAnyFile, parseMaster, masterToBooking, extractSummary, reconcileReportTotals,
  classifyDuplicate, type MasterBooking, type MasterImportResult,
} from '../utils/masterImport';
import { downloadMasterTemplate, exportMasterCsv, roundTripCompare } from '../utils/masterExport';
import { exportMasterWorkbookFull } from '../utils/masterExport';
import { detectTemplateFormat, parseBookingTemplate, downloadLegacyRekapTemplate } from '../utils/bookingTemplate';

interface Props {
  existing: Booking[];
  settings?: CompanySettings;
  onImport: (bookings: Booking[]) => { committed: number; rejected: number };
  onBack?: () => void;
}

type Tab = 'import' | 'export' | 'history' | 'log';
type Mode = 'safe' | 'warning' | 'full';

interface AuditEntry {
  importId: string; filename: string; fileType: string; uploadedAt: string;
  uploadedBy: string;
  totalRows: number; totalBookings: number; valid: number; warning: number; error: number;
  duplicate: number; mismatches: number; mode: string; result: string; checksum: string;
}

const AUDIT_KEY = 'tamima_import_audit';
const loadAudit = (): AuditEntry[] => { try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; } };

const checksum = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
const bufferChecksum = (buffer: ArrayBuffer) => {
  let hash = 5381;
  for (const byte of new Uint8Array(buffer)) hash = ((hash << 5) + hash + byte) | 0;
  return (hash >>> 0).toString(16);
};

const VERDICT_STYLE: Record<string, string> = {
  VALID: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  WARNING: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
  ERROR: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300',
  DUPLICATE: 'bg-slate-200 text-slate-700 border-slate-400 dark:bg-slate-800 dark:text-slate-300',
};

const STEPS = ['Parsing file', 'Detecting structure', 'Normalizing', 'Validating', 'Auditing calculations', 'Checking duplicates', 'Preparing transaction'];

export const ImportExcel: React.FC<Props> = ({ existing, settings, onImport, onBack }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>('import');
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(-1);
  const [fileInfo, setFileInfo] = useState('');
  const [result, setResult] = useState<MasterImportResult | null>(null);
  const [summary, setSummary] = useState<ReturnType<typeof extractSummary> | null>(null);
  const [dupClasses, setDupClasses] = useState<Map<string, string>>(new Map());
  const [templateBookings, setTemplateBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MasterBooking | null>(null);
  const [previewTab, setPreviewTab] = useState<'bookings' | 'calc' | 'dups' | 'warnings' | 'errors'>('bookings');
  const [mode, setMode] = useState<Mode>('safe');
  const [nightsChoice, setNightsChoice] = useState<'source' | 'calculated'>('source');
  const [imported, setImported] = useState(false);
  const [roundTrip, setRoundTrip] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(loadAudit);
  const [postVerify, setPostVerify] = useState<string | null>(null);
  const [sourceChecksum, setSourceChecksum] = useState('');

  const tolerance = settings?.importToleranceSAR ?? 0.01;
  const fallbackRate = settings?.defaultExchangeRateSARtoIDR || 4250;

  const overallQuality = useMemo(() => {
    if (!result || result.bookings.length === 0) return 100;
    return Math.round(result.bookings.reduce((s, b) => s + b.quality, 0) / result.bookings.length);
  }, [result]);

  const runProgress = async () => {
    for (let i = 0; i < STEPS.length; i++) { setProgress(i); await new Promise((r) => setTimeout(r, 160)); }
    setProgress(STEPS.length);
  };

  const parseFile = async (file: File) => {
    setBusy(true); setError(''); setResult(null); setTemplateBookings(null); setImported(false); setPostVerify(null);
    setProgress(0); setFileInfo(`${file.name} · ${(file.size / 1024).toFixed(1)} KB`);
    try {
      const buf = await file.arrayBuffer();
      setSourceChecksum(bufferChecksum(buf));
      const fileRes = await readAnyFile(buf);
      setFileInfo(`${file.name} · ${fileRes.kind}${fileRes.pdf ? ` · ${fileRes.pdf.pages} pages · tables: ${fileRes.pdf.tables} · text: ${fileRes.pdf.scanned ? 'FAIL (OCR_REQUIRED)' : 'PASS'}` : ''}`);

      if (fileRes.pdf?.scanned) {
        setError('OCR_REQUIRED — PDF berisi gambar scan. Data tidak dimasukkan secara paksa; gunakan file text-based atau OCR pipeline.');
        setBusy(false); setProgress(-1);
        return;
      }

      await runProgress();

      // 1) Master / legacy REKAP block format (BOOKING #N + combined DBL Q/R + BUY/SELL rows)
      const res = parseMaster(fileRes.aoa, existing.map((b) => b.bookingRef), tolerance);
      res.fileKind = fileRes.kind;

      if (res.bookings.length > 0) {
        const dcs = new Map<string, string>();
        res.bookings.forEach((b) => {
          if (!b.dupOfExisting && !b.dupOfFile) dcs.set(b.bookingNo, classifyDuplicate(b, existing));
        });
        setDupClasses(dcs);
        setSummary(extractSummary(fileRes.aoa));
        setResult(res);
      } else if (detectTemplateFormat(fileRes.aoa)) {
        // 2) New "TEMPLATE INPUT DATA BOOKING" format (split Qty/Rate columns)
        const bs = parseBookingTemplate(fileRes.aoa, fallbackRate);
        if (bs.length === 0) setError('Format template terdeteksi, tetapi tidak ada baris BUY/SELL valid.');
        else setTemplateBookings(bs);
      } else if (res.critical.length > 0) {
        setSummary(extractSummary(fileRes.aoa));
        setResult(res);
      } else {
        setError('Tidak ada booking terdeteksi. File harus memuat blok "BOOKING #N" dengan baris Type/BUY/SELL, atau format Template Input (METADATA TRANSAKSI).');
      }
    } catch (e) {
      console.error(e);
      setError('File tidak dapat dibaca (corrupted / unreadable worksheet).');
    } finally {
      setBusy(false);
    }
  };

  const importableByMode = (m: Mode): MasterBooking[] => {
    if (!result) return [];
    return result.bookings.filter((b) => {
      const dc = dupClasses.get(b.bookingNo);
      if (b.verdict === 'ERROR' || dc === 'EXACT_DUPLICATE' || b.dupOfFile) return false;
      if (m === 'safe') return b.verdict === 'VALID' && dc !== 'POSSIBLE_DUPLICATE';
      if (m === 'warning') return b.verdict === 'VALID' || b.verdict === 'WARNING';
      return true; // full review: everything non-error after user review
    });
  };

  const canImport = (templateBookings ? templateBookings.length > 0 : importableByMode(mode).length > 0 && (!result || result.critical.length === 0));

  const writeAudit = (entry: Omit<AuditEntry, 'importId' | 'uploadedAt' | 'checksum' | 'uploadedBy'>) => {
    const e: AuditEntry = {
      ...entry,
      importId: `IMP-${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: settings?.defaultStaffName || 'Local User',
      checksum: sourceChecksum || checksum(entry.filename),
    };
    const next = [e, ...auditLog].slice(0, 30);
    setAuditLog(next);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(next));
    return e;
  };

  const doImport = () => {
    const list = templateBookings ?? importableByMode(mode).map((b) =>
      masterToBooking(b, { useCalculatedNights: nightsChoice === 'calculated', fallbackRate })
    );
    if (list.length === 0) return;
    if (mode === 'full' && result && (result.counts.warning > 0 || result.counts.mismatches > 0)) {
      if (!confirm(`FULL REVIEW: ${list.length} record akan diimport termasuk WARNING/mismatch. Lanjutkan?`)) return;
    }
    const commit = onImport(list);
    if (commit.committed !== list.length) {
      setError(
        `ATOMIC IMPORT ROLLBACK — ${commit.rejected} duplicate/conflicting record ditemukan saat commit. ` +
          'Tidak ada data yang disimpan.'
      );
      setImported(false);
      return;
    }
    setImported(true);
    writeAudit({
      filename: fileInfo.split(' · ')[0], fileType: result?.fileKind || 'template',
      totalRows: result?.rowsDetected ?? list.length, totalBookings: result?.bookings.length ?? list.length,
      valid: result?.counts.valid ?? list.length, warning: result?.counts.warning ?? 0,
      error: result?.counts.error ?? 0, duplicate: result?.counts.duplicate ?? 0,
      mismatches: result?.counts.mismatches ?? 0, mode, result: 'COMMITTED',
    });
    // POST-IMPORT VALIDATION
    setPostVerify(
      `POST-IMPORT VALIDATION: ${commit.committed} record committed · source ${
        result?.bookings.length ?? list.length
      } · committed count MATCH · booking references verified`
    );
  };

  const runRoundTrip = () => {
    // Database → Export XLSX → Import XLSX → Normalize → Compare
    Promise.all([import('xlsx'), import('../utils/masterExport')]).then(([XLSXmod, me]) => {
      const rows = [me.masterHeader(), ...existing.map(me.bookingToMasterRow)];
      const ws = XLSXmod.utils.aoa_to_sheet(rows);
      const aoa2 = XLSXmod.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
      const re = parseMaster(aoa2, [], tolerance);
      const diffs = roundTripCompare(existing, re.bookings);
      setRoundTrip(diffs.length === 0
        ? `ROUND-TRIP PASS ✓ — ${existing.length} booking · count/booking_no/hotel/customer/dates/nights/BUY/SELL/IDR/profitability same · 0 field-level diff.`
        : `ROUND-TRIP: ${diffs.length} field-level diff:\n` + diffs.slice(0, 25).map((d) => `• ${d.bookingNo} · ${d.field}: "${d.original}" → "${d.reimported}"`).join('\n'));
    }).catch((e) => { console.error(e); setRoundTrip('Round-trip test gagal dijalankan.'); });
  };

  const recon = summary && result ? reconcileReportTotals(summary, result.bookings) : [];

  return (
    <div className="space-y-5 pb-16">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-orange-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Booking List
        </button>
      )}

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-orange-950 text-white p-6 shadow-xl border border-slate-800">
        <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none"><FileSpreadsheet className="w-56 h-56 text-orange-400" /></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-orange-400 uppercase">READ → DETECT → UNDERSTAND → VALIDATE → RECONCILE</p>
            <h2 className="text-2xl font-extrabold mt-1">Master Import & Export Engine</h2>
            <p className="text-xs text-slate-300 mt-1">XLSX · XLS binary · XLS legacy HTML · CSV · PDF text-table — header semantic, audit kalkulasi, proteksi duplikat, import atomik.</p>
          </div>
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs font-bold">
            {([['import', 'IMPORT'], ['export', 'EXPORT'], ['history', 'IMPORT HISTORY'], ['log', 'VALIDATION LOG']] as [Tab, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg transition-all ${tab === t ? 'bg-orange-500 text-white' : 'text-slate-300 hover:text-white'}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ================= IMPORT TAB ================= */}
      {tab === 'import' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${dragOver ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 scale-[1.01]' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-500'}`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg">
              {busy ? <Loader2 className="w-7 h-7 animate-spin" /> : <FileUp className="w-7 h-7" />}
            </div>
            <p className="mt-3 font-extrabold text-slate-900 dark:text-white">DROP FILE HERE</p>
            <p className="text-[11px] text-slate-500 mt-1">XLSX · XLS · CSV · PDF — parser dipilih dari signature isi file</p>
            <div className="flex justify-center gap-2 mt-3">
              <button onClick={(e) => { e.stopPropagation(); downloadMasterTemplate(); }} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-1.5 rounded-lg text-[11px]"><Download className="w-3.5 h-3.5" />Master Template</button>
              <button onClick={(e) => { e.stopPropagation(); downloadLegacyRekapTemplate(settings || ({} as CompanySettings)); }} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-lg text-[11px]">Template Rekap Q/R</button>
            </div>
          </div>

          {/* Progress */}
          {progress >= 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2 text-[11px]">
                  {progress > i ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : progress === i ? <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />}
                  <span className={progress >= i ? 'text-slate-800 dark:text-slate-200 font-semibold' : 'text-slate-400'}>{s}</span>
                  <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-200`} style={{ width: progress > i ? '100%' : progress === i ? '55%' : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FILE ANALYSIS */}
          {(result || templateBookings) && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><p className="text-slate-400 text-[9px] font-black uppercase">File</p><p className="font-bold truncate">{fileInfo}</p></div>
              <div><p className="text-slate-400 text-[9px] font-black uppercase">Detected bookings</p><p className="font-black text-lg">{result?.bookings.length ?? templateBookings?.length ?? 0}</p></div>
              <div><p className="text-slate-400 text-[9px] font-black uppercase">Data quality</p><p className={`font-black text-lg ${overallQuality >= 90 ? 'text-emerald-600' : overallQuality >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>{overallQuality}%</p></div>
              <div><p className="text-slate-400 text-[9px] font-black uppercase">Report count check</p>
                <p className={`font-bold ${summary?.bookingCount == null || summary.bookingCount === result?.bookings.length ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {summary?.bookingCount != null ? `${summary.bookingCount} vs ${result?.bookings.length} ${summary.bookingCount === result?.bookings.length ? '✓' : 'BOOKING_COUNT_MISMATCH'}` : 'n/a'}
                </p>
              </div>
            </div>
          )}

          {error && <div className="flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 dark:text-rose-300 rounded-xl p-4 text-xs font-semibold"><FileWarning className="w-4 h-4 mt-0.5" />{error}</div>}

          {result && result.critical.length > 0 && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-400 rounded-xl p-4 text-xs text-rose-800 dark:text-rose-300">
              <p className="font-black flex items-center gap-1.5 mb-1"><ShieldAlert className="w-4 h-4" /> CRITICAL — ROLLBACK ALL, tidak ada yang di-commit</p>
              {result.critical.map((c, i) => <p key={i}>• {c.msg}</p>)}
            </div>
          )}

          {/* Report total reconciliation */}
          {recon.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Report Total Reconciliation</p>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
                {recon.map((r) => (
                  <div key={r.field} className={`rounded-lg border px-2.5 py-2 ${r.ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40' : 'border-amber-400 bg-amber-50 dark:bg-amber-950/40'}`}>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{r.field}</p>
                    <p className="text-[10px]">Report {r.report.toLocaleString('id-ID')} · Calc {r.computed.toLocaleString('id-ID')}</p>
                    <p className={`font-black ${r.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{r.ok ? 'PASS' : `REPORT_TOTAL_MISMATCH Δ${r.diff.toLocaleString('id-ID')}`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode + nights controls */}
          {result && result.bookings.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-black text-slate-700 dark:text-slate-200 mb-1.5">IMPORT MODE</p>
                <div className="flex gap-1">
                  {([['safe', 'Safe (PASS only)'], ['warning', 'With Warning'], ['full', 'Full Review']] as [Mode, string][]).map(([m, l]) => (
                    <button key={m} onClick={() => setMode(m)} className={`flex-1 px-2 py-1.5 rounded-lg font-bold border transition-all ${mode === m ? 'bg-slate-900 dark:bg-orange-500 text-white border-transparent' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-black text-slate-700 dark:text-slate-200 mb-1.5">NIGHTS MISMATCH →</p>
                <div className="flex gap-1">
                  {(['source', 'calculated'] as const).map((p) => (
                    <button key={p} onClick={() => setNightsChoice(p)} className={`flex-1 px-2 py-1.5 rounded-lg font-bold border transition-all ${nightsChoice === p ? 'bg-slate-900 dark:bg-orange-500 text-white border-transparent' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{p === 'source' ? 'Use Source' : 'Use Calculated'}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview tabs */}
          {result && result.bookings.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold">
                {([['bookings', `BOOKINGS (${result.bookings.length})`], ['calc', `CALCULATION (${result.counts.mismatches})`], ['dups', `DUPLICATES (${result.counts.duplicate})`], ['warnings', `WARNINGS (${result.counts.warning})`], ['errors', `ERRORS (${result.counts.error})`]] as const).map(([t, l]) => (
                  <button key={t} onClick={() => setPreviewTab(t)} className={`px-3 py-1.5 rounded-lg transition-all ${previewTab === t ? 'bg-slate-900 dark:bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{l}</button>
                ))}
              </div>
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                {previewTab === 'bookings' && (
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-900 text-white text-[9px] font-black uppercase sticky top-0">
                      <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Booking</th><th className="px-3 py-2 text-left">Hotel</th><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Period</th><th className="px-3 py-2 text-right">BUY</th><th className="px-3 py-2 text-right">SELL</th><th className="px-3 py-2 text-right">Profit</th><th className="px-3 py-2 text-center">Quality</th><th className="px-3 py-2 text-center">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {result.bookings.map((b, i) => {
                        const dc = dupClasses.get(b.bookingNo);
                        const verdict = b.dupOfFile || dc === 'EXACT_DUPLICATE' ? 'DUPLICATE' : b.verdict;
                        return (
                          <tr key={b.bookingNo} onClick={() => setSelected(b)} className="cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-slate-800/60">
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2 font-mono font-bold text-orange-600">{b.bookingNo}</td>
                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{b.hotel || '—'}</td>
                            <td className="px-3 py-2">{b.customer || '—'}</td>
                            <td className="px-3 py-2 text-slate-500">{b.checkIn || '?'} → {b.checkOut || '?'}</td>
                            <td className="px-3 py-2 text-right">SAR {Math.round(b.buy.totalSAR ?? 0).toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2 text-right font-bold">SAR {Math.round(b.sell.totalSAR ?? 0).toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2 text-right text-emerald-700 font-bold">{Math.round(b.netProfitIDR ?? 0).toLocaleString('id-ID')}</td>
                            <td className="px-3 py-2 text-center font-black">{b.quality}</td>
                            <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${VERDICT_STYLE[verdict]}`}>{dc === 'POSSIBLE_DUPLICATE' ? 'POSSIBLE DUP' : verdict}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {previewTab === 'calc' && (
                  <div className="p-4 space-y-2 text-[11px]">
                    {result.bookings.flatMap((b) => b.fields.filter((f) => f.status !== 'VALID').map((f, i) => (
                      <div key={b.bookingNo + i} className="border border-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-2.5">
                        <b>{b.bookingNo} · {f.label}</b> — Source {f.source} · Calculated {f.calculated} · Δ {f.variance} <span className="font-black text-amber-700">CALCULATION_MISMATCH</span>
                      </div>
                    )))}
                    {result.bookings.every((b) => b.fields.every((f) => f.status === 'VALID')) && <p className="text-emerald-600 font-bold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Seluruh kalkulasi PASS — source = calculated.</p>}
                  </div>
                )}
                {previewTab === 'dups' && (
                  <div className="p-4 space-y-2 text-[11px]">
                    {result.bookings.filter((b) => b.dupOfFile || dupClasses.get(b.bookingNo) === 'EXACT_DUPLICATE' || dupClasses.get(b.bookingNo) === 'POSSIBLE_DUPLICATE').map((b) => (
                      <div key={b.bookingNo} className="border border-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5">
                        <b>{b.bookingNo}</b> — {dupClasses.get(b.bookingNo) || (b.dupOfFile ? 'DUPLICATE_IN_FILE' : '')} · {b.hotel} · {b.customer} · {b.checkIn}→{b.checkOut}
                      </div>
                    ))}
                    {result.bookings.every((b) => !b.dupOfFile && dupClasses.get(b.bookingNo) === 'NEW_RECORD') && <p className="text-emerald-600 font-bold">Semua record NEW_RECORD — tidak ada duplikat.</p>}
                  </div>
                )}
                {(previewTab === 'warnings' || previewTab === 'errors') && (
                  <div className="p-4 space-y-1.5 text-[11px]">
                    {result.bookings.flatMap((b) => b.issues.filter((x) => previewTab === 'errors' ? x.level === 'ERROR' || x.level === 'CRITICAL' : x.level === 'WARNING' || x.level === 'INFO').map((x, i) => (
                      <div key={b.bookingNo + i} className={`rounded-lg px-2.5 py-1.5 border ${x.level === 'ERROR' || x.level === 'CRITICAL' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-700' : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700'}`}>
                        <b>{b.bookingNo}</b> [{x.level}] {x.msg}
                      </div>
                    )))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-between items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[10px] text-slate-400">{importableByMode(mode).length} record siap · mode {mode} · tolerance SAR {tolerance}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setResult(null); setProgress(-1); }} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs">Cancel</button>
                  <button onClick={doImport} disabled={!canImport || imported} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black px-5 py-2 rounded-xl text-xs shadow-lg active:scale-95 transition-all">
                    <Database className="w-4 h-4" />{imported ? 'Committed ✓' : mode === 'safe' ? 'Import Valid Records' : mode === 'warning' ? 'Import PASS + WARNING' : 'Import All After Review'}
                  </button>
                </div>
              </div>
              {postVerify && <p className="px-4 pb-3 text-[10px] font-bold text-emerald-600">{postVerify}</p>}
            </div>
          )}

          {templateBookings && (
            <div className="rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-4 flex flex-wrap items-center gap-3 border border-emerald-700">
              <CheckCircle2 className="w-6 h-6 text-emerald-300" />
              <div className="mr-auto"><p className="font-black text-sm">Template input terdeteksi — {templateBookings.length} booking siap</p></div>
              <button
                onClick={() => {
                  const commit = onImport(templateBookings);
                  if (commit.committed === templateBookings.length) setImported(true);
                  else setError(`ATOMIC IMPORT ROLLBACK — ${commit.rejected} duplicate/conflict ditemukan.`);
                }}
                disabled={imported}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-black px-5 py-2.5 rounded-xl text-xs active:scale-95"
              >
                {imported ? 'Tersimpan ✓' : 'Setujui & Simpan'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================= EXPORT TAB ================= */}
      {tab === 'export' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={() => exportMasterWorkbookFull(existing, auditLog[0])} className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-emerald-300 hover:border-emerald-500 hover:shadow-lg transition-all text-xs font-bold text-slate-700 dark:text-slate-200">
              <FileSpreadsheet className="w-7 h-7 text-emerald-600" /> Master XLSX (7 sheets)
            </button>
            <button onClick={() => exportMasterCsv(existing)} className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-300 hover:border-slate-500 hover:shadow-lg transition-all text-xs font-bold text-slate-700 dark:text-slate-200">
              <FileText className="w-7 h-7 text-slate-500" /> CSV
            </button>
            <button onClick={() => downloadMasterTemplate()} className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-orange-300 hover:border-orange-500 hover:shadow-lg transition-all text-xs font-bold text-slate-700 dark:text-slate-200">
              <Download className="w-7 h-7 text-orange-500" /> Master Template + README
            </button>
            <button onClick={runRoundTrip} className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-300 hover:border-slate-500 hover:shadow-lg transition-all text-xs font-bold text-slate-700 dark:text-slate-200">
              <RefreshCw className="w-7 h-7 text-sky-500" /> Round-Trip Test
            </button>
          </div>
          {roundTrip && <pre className="whitespace-pre-wrap bg-slate-900 text-emerald-300 text-[11px] font-mono rounded-xl p-4 border border-slate-700">{roundTrip}</pre>}
          <p className="text-[10px] text-slate-400">Export dibangun dari canonical database data (bukan UI state) · EXPORT → IMPORT AGAIN = 100% logical equivalence.</p>
        </div>
      )}

      {/* ================= HISTORY TAB ================= */}
      {tab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-900 text-white text-[9px] font-black uppercase">
                <tr><th className="px-3 py-2 text-left">Import ID</th><th className="px-3 py-2 text-left">File</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Bookings</th><th className="px-3 py-2 text-right">Valid</th><th className="px-3 py-2 text-right">Warn</th><th className="px-3 py-2 text-right">Err</th><th className="px-3 py-2 text-left">Mode</th><th className="px-3 py-2 text-left">Result</th><th className="px-3 py-2 text-left">When</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLog.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Belum ada riwayat import.</td></tr>}
                {auditLog.map((a) => (
                  <tr key={a.importId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-2 font-mono text-orange-600 font-bold">{a.importId}</td>
                    <td className="px-3 py-2 font-bold">{a.filename}</td>
                    <td className="px-3 py-2">{a.fileType}</td>
                    <td className="px-3 py-2 text-right font-bold">{a.totalBookings}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-bold">{a.valid}</td>
                    <td className="px-3 py-2 text-right text-amber-600 font-bold">{a.warning}</td>
                    <td className="px-3 py-2 text-right text-rose-600 font-bold">{a.error}</td>
                    <td className="px-3 py-2">{a.mode}</td>
                    <td className="px-3 py-2 font-black text-emerald-600">{a.result}</td>
                    <td className="px-3 py-2 text-slate-500">{new Date(a.uploadedAt).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VALIDATION LOG TAB ================= */}
      {tab === 'log' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2 text-[11px]">
          <p className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5"><ScrollText className="w-4 h-4" /> Validation & Audit Log</p>
          {auditLog.length === 0 && <p className="text-slate-400">Belum ada log validasi.</p>}
          {auditLog.map((a) => (
            <div key={a.importId} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <p className="font-bold">{a.importId} · {a.filename} · checksum {a.checksum}</p>
              <p className="text-slate-500">rows {a.totalRows} · bookings {a.totalBookings} · valid {a.valid} · warning {a.warning} · error {a.error} · dup {a.duplicate} · mismatch {a.mismatches} · mode {a.mode} · <b className="text-emerald-600">{a.result}</b></p>
            </div>
          ))}
        </div>
      )}

      {/* ===== DETAIL DRAWER ===== */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 text-white px-4 py-3 flex items-center justify-between z-10">
              <div><p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Validation Detail · Quality {selected.quality}</p><p className="font-black">{selected.bookingNo} · {selected.hotel || '—'}</p></div>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-800 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${VERDICT_STYLE[selected.verdict]}`}>{selected.verdict}</span>
              {selected.fields.map((f, i) => (
                <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between"><span className="font-black">{f.label}</span><span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${f.status === 'VALID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{f.status}</span></div>
                  <div className="grid grid-cols-2 gap-1 text-slate-600 dark:text-slate-300">
                    <span>Source: <b>{f.source}</b></span>
                    <span>Normalized: <b>{f.normalized}</b></span>
                    {f.calculated && <span>Calculated: <b>{f.calculated}</b></span>}
                    {f.variance && <span>Variance: <b className="text-amber-600">{f.variance}</b></span>}
                  </div>
                </div>
              ))}
              {selected.issues.map((iss, i) => (
                <div key={i} className={`text-[10px] font-semibold rounded-lg px-2.5 py-1.5 border ${iss.level === 'ERROR' || iss.level === 'CRITICAL' ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 border-rose-300' : iss.level === 'WARNING' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 border-amber-300' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 border-slate-200'}`}>
                  <b>{iss.level}</b> — {iss.msg}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExcel;
