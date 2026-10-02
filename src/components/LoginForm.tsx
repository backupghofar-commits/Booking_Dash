'use client';

import { FormEvent, useState } from 'react';
import { Building2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/client-api';

const DEMOS = [
  { role: 'Admin', email: 'admin@tamima.local' },
  { role: 'Manager', email: 'manager@tamima.local' },
  { role: 'Staff', email: 'staff@tamima.local' },
  { role: 'Finance', email: 'finance@tamima.local' },
  { role: 'Viewer', email: 'viewer@tamima.local' },
];

export function LoginForm() {
  const [email, setEmail] = useState('admin@tamima.local');
  const [password, setPassword] = useState('Tamima@2026');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,0.18),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(245,158,11,0.12),_transparent_45%)]" />
      <div className="relative max-w-6xl mx-auto px-4 py-10 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div className="hidden lg:block space-y-6 pr-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            PT Tamima Jaya Wisata
          </div>
          <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-tight">
            Hotel, Haramain &amp; Armada
            <span className="block text-emerald-400">booking operations</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-md">
            Dual-currency profitability engine for Makkah · Madinah · Jeddah. Secure staff access with role-based
            permissions, live SAR/IDR ledgers, vouchers, and audit trails.
          </p>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            {[
              ['Hotel', 'Confirmation letters'],
              ['HHR', 'Train tickets'],
              ['Armada', 'Charter vouchers'],
            ].map(([k, v]) => (
              <div key={k} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <dt className="text-emerald-300 font-black">{k}</dt>
                <dd className="text-slate-400 mt-1">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 max-w-md w-full mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-700">TAMIMA PRO</p>
              <h2 className="text-xl font-black">Sign in</h2>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-xs font-bold text-slate-600">
              Email
              <div className="mt-1 relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </label>
            <label className="block text-xs font-bold text-slate-600">
              Password
              <div className="mt-1 relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-600/20"
            >
              {busy ? 'Signing in…' : 'Enter workspace'}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Demo accounts · password Tamima@2026</p>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMOS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword('Tamima@2026');
                  }}
                  className="flex items-center justify-between text-left text-xs px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <span className="font-bold text-slate-700">{d.role}</span>
                  <span className="text-slate-500 font-mono">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
