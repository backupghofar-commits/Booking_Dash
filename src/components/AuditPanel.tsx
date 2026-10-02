'use client';

import { useEffect, useState } from 'react';
import { History, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/client-api';

type Log = {
  id: string;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
};

export function AuditPanel() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async (query = q) => {
    try {
      const data = await api<{ logs: Log[] }>(`/api/audit?q=${encodeURIComponent(query)}`);
      setLogs(data.logs);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load audit trail');
    }
  };

  useEffect(() => {
    void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-black">Audit trail</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(q);
          }}
          className="relative"
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search action, user, entity…"
            className="pl-9 pr-3 py-2 rounded-xl border text-sm w-72"
          />
        </form>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {logs.length === 0 && !error && (
        <div className="bg-white border rounded-2xl p-10 text-center text-slate-500 text-sm">No audit events yet.</div>
      )}
      <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3 text-xs">{l.userEmail || 'system'}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-100">{l.action}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {l.entity}
                  {l.entityId ? <span className="text-slate-400"> · {l.entityId}</span> : null}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-md truncate">{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
