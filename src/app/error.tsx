'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-rose-300 font-bold">Workspace error</p>
        <h1 className="text-2xl font-black">Something went wrong</h1>
        <p className="text-sm text-slate-400">{error.message || 'Unexpected application error'}</p>
        <button onClick={reset} className="bg-emerald-600 hover:bg-emerald-500 font-bold px-4 py-2 rounded-xl text-sm">
          Try again
        </button>
      </div>
    </div>
  );
}
