'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Shield, UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/client-api';
import { ROLES, type Role } from '@/lib/auth/permissions';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'STAFF' as Role, password: 'Tamima@2026' });

  const load = async () => {
    try {
      const data = await api<{ users: UserRow[] }>('/api/users');
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load users');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(form) });
      setOk('User created');
      setForm({ name: '', email: '', role: 'STAFF', password: 'Tamima@2026' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    try {
      await api('/api/users', { method: 'PUT', body: JSON.stringify({ id, ...body }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-black">Users &amp; roles</h2>
      </div>
      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{ok}</p>}

      <form onSubmit={create} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input className="input-like px-3 py-2 rounded-xl border text-sm" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="px-3 py-2 rounded-xl border text-sm" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <select className="px-3 py-2 rounded-xl border text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input className="px-3 py-2 rounded-xl border text-sm" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white font-bold rounded-xl text-sm">
          <UserPlus className="w-4 h-4" /> Add user
        </button>
      </form>

      <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3">
                  <div className="font-bold">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="text-xs border rounded-lg px-2 py-1"
                    value={u.role}
                    onChange={(e) => void patch(u.id, { role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : '—'}
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    disabled={u.id === currentUserId}
                    onClick={() => void patch(u.id, { active: !u.active })}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 disabled:opacity-40"
                  >
                    {u.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => {
                      const pw = window.prompt('New password (min 8 chars, letters + numbers)', 'Tamima@2026');
                      if (pw) void patch(u.id, { password: pw });
                    }}
                    className="text-xs font-bold text-amber-700"
                  >
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
