export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 mx-auto mb-4 animate-pulse" />
        <p className="text-slate-300 text-sm font-semibold">Loading TAMIMA workspace…</p>
      </div>
    </div>
  );
}
