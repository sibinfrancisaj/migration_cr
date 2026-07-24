import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAiEmbeddingStatus,
  fetchEmbeddings,
  recomputeEmbedding,
  recomputeAllStale,
  proposeAiDrops,
  generatePreConnections,
} from '@/api/aiMonitoring';
import type { EmbeddingItem } from '@/api/aiMonitoring';

export default function AiMonitoringPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('stale');
  const [proposeRegion, setProposeRegion] = useState('');
  const [preConnectEventId, setPreConnectEventId] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['ai-embedding-status'],
    queryFn: fetchAiEmbeddingStatus,
    refetchInterval: 15_000,
  });

  const { data: embeddings = [], isLoading: embLoading } = useQuery({
    queryKey: ['ai-embeddings', statusFilter],
    queryFn: () => fetchEmbeddings({ status: statusFilter, limit: 50 }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ai-embedding-status'] });
    qc.invalidateQueries({ queryKey: ['ai-embeddings'] });
  };

  const recomputeOneMut = useMutation({
    mutationFn: recomputeEmbedding,
    onSuccess: () => { invalidate(); showToast('Recompute queued'); },
  });

  const recomputeAllMut = useMutation({
    mutationFn: recomputeAllStale,
    onSuccess: () => { invalidate(); showToast('All stale embeddings queued for recompute'); },
  });

  const proposeDropsMut = useMutation({
    mutationFn: () => proposeAiDrops(proposeRegion.trim()),
    onSuccess: () => { setProposeRegion(''); showToast('AI drop proposals enqueued'); },
  });

  const preConnectMut = useMutation({
    mutationFn: () => generatePreConnections(preConnectEventId.trim()),
    onSuccess: () => { setPreConnectEventId(''); showToast('Pre-connections enqueued'); },
  });

  const statCards = [
    { label: 'Total Embeddings', value: status?.total ?? '—', color: 'text-gray-900' },
    { label: 'Stale', value: status?.stale ?? '—', color: 'text-yellow-600' },
    { label: 'Coverage Rate', value: status?.coverageRate ?? '—', color: 'text-green-600' },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Monitoring</h1>
        <p className="text-gray-500 text-sm mt-1">Profile embeddings, AI proposals, and pre-connections</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            {statusLoading
              ? <div className="h-8 bg-gray-200 rounded animate-pulse mb-2" />
              : <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            }
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            {s.label === 'Total Embeddings' && status?.lastComputedAt && (
              <p className="text-xs text-gray-400 mt-1">Last: {new Date(status.lastComputedAt).toLocaleString()}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Embeddings table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Embeddings</h2>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none"
              >
                <option value="stale">Stale</option>
                <option value="all">All</option>
              </select>
              <button
                onClick={() => recomputeAllMut.mutate()}
                disabled={recomputeAllMut.isPending}
                className="text-xs px-2 py-1 rounded text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: '#d97706' }}
              >
                {recomputeAllMut.isPending ? '…' : 'Recompute All Stale'}
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-80">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {embLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 3 }).map((_, j) => (
                          <td key={j} className="px-4 py-2"><div className="h-3 bg-gray-200 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  : embeddings.length === 0
                  ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-xs">No embeddings</td></tr>
                  : embeddings.map((emb: EmbeddingItem) => (
                      <tr key={emb.userId} className="hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <p className="text-xs font-medium text-gray-800">{emb.profileName ?? '—'}</p>
                          <p className="text-xs font-mono text-gray-400">{emb.userId.slice(0, 8)}…</p>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${emb.isStale ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {emb.isStale ? 'Stale' : 'Fresh'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => recomputeOneMut.mutate(emb.userId)}
                            disabled={recomputeOneMut.isPending}
                            className="text-xs text-amber-600 hover:text-amber-800"
                          >
                            Recompute
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-3">Propose AI Introduction Drops</h2>
            <p className="text-xs text-gray-500 mb-3">AI will analyse profiles in the region and create DRAFT drops for admin review.</p>
            <div className="flex gap-2">
              <input
                value={proposeRegion}
                onChange={e => setProposeRegion(e.target.value)}
                placeholder="Country code, e.g. GB"
                className="input flex-1 text-sm"
              />
              <button
                onClick={() => proposeDropsMut.mutate()}
                disabled={!proposeRegion.trim() || proposeDropsMut.isPending}
                className="btn-primary disabled:opacity-50 whitespace-nowrap"
              >
                {proposeDropsMut.isPending ? '…' : 'Propose'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-3">Generate Event Pre-connections</h2>
            <p className="text-xs text-gray-500 mb-3">AI creates curated introductions 72h before an event for all RSVP'd attendees.</p>
            <div className="flex gap-2">
              <input
                value={preConnectEventId}
                onChange={e => setPreConnectEventId(e.target.value)}
                placeholder="Event ID (UUID)"
                className="input flex-1 text-sm"
              />
              <button
                onClick={() => preConnectMut.mutate()}
                disabled={!preConnectEventId.trim() || preConnectMut.isPending}
                className="btn-primary disabled:opacity-50 whitespace-nowrap"
              >
                {preConnectMut.isPending ? '…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
