import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuditLog } from '@/api/auditLog';
import type { AuditLogEntry } from '@/api/auditLog';

export default function AuditLogPage() {
  const [adminId, setAdminId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', adminId, action, page],
    queryFn: () => fetchAuditLog({
      adminId: adminId.trim() || undefined,
      action: action.trim() || undefined,
      page,
      limit,
    }),
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const resetPage = () => setPage(1);

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500 text-sm mt-1">Track all admin actions across the platform</p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input
            value={adminId}
            onChange={e => { setAdminId(e.target.value); resetPage(); }}
            placeholder="Filter by Admin ID…"
            className="input flex-1 text-sm"
          />
          <input
            value={action}
            onChange={e => { setAction(e.target.value); resetPage(); }}
            placeholder="Filter by action…"
            className="input flex-1 text-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : entries.length === 0
                ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-400">No audit entries found</td>
                  </tr>
                )
                : entries.map((entry: AuditLogEntry) => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelected(entry)}
                      className={`cursor-pointer hover:bg-amber-50 transition-colors ${selected?.id === entry.id ? 'bg-amber-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-xs">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {entry.entityType && (
                          <span>{entry.entityType}{entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{entry.adminId.slice(0, 10)}…</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-400">
              {total > 0 ? `Page ${page} of ${totalPages} · ${total} total` : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Entry Detail</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Action</p>
              <p className="font-mono text-sm text-gray-800">{selected.action}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Admin ID</p>
              <p className="font-mono text-xs text-gray-600 break-all">{selected.adminId}</p>
            </div>
            {selected.entityType && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Entity</p>
                <p className="text-sm text-gray-700">{selected.entityType}</p>
                {selected.entityId && <p className="font-mono text-xs text-gray-500 break-all">{selected.entityId}</p>}
              </div>
            )}
            {selected.meta && Object.keys(selected.meta).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Metadata</p>
                <pre className="text-xs bg-gray-50 rounded p-3 overflow-x-auto text-gray-700">
                  {JSON.stringify(selected.meta, null, 2)}
                </pre>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Timestamp</p>
              <p className="text-sm text-gray-700">{new Date(selected.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
