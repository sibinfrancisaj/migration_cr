import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
} from '@/api/featureFlags';
import type { FeatureFlag } from '@/api/featureFlags';

export default function FeatureFlagsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRollout, setNewRollout] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['feature-flags'] });

  const createMut = useMutation({
    mutationFn: () => createFeatureFlag({ key: newKey.trim(), description: newDesc.trim() || undefined, rolloutPercentage: newRollout }),
    onSuccess: () => { invalidate(); setShowCreate(false); setNewKey(''); setNewDesc(''); setNewRollout(0); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => updateFeatureFlag(key, { enabled }),
    onSuccess: invalidate,
  });

  const rolloutMut = useMutation({
    mutationFn: ({ key, pct }: { key: string; pct: number }) => updateFeatureFlag(key, { rolloutPercentage: pct }),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (key: string) => deleteFeatureFlag(key),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-gray-500 text-sm mt-1">Control feature rollouts and A/B experiments</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary"
        >
          + New Flag
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Flag Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Enabled</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rollout %</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              : flags.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">No feature flags yet</td>
                </tr>
              )
              : flags.map((flag: FeatureFlag) => (
                  <tr key={flag.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-medium text-gray-900">{flag.key}</p>
                      {flag.description && <p className="text-xs text-gray-500 mt-0.5">{flag.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMut.mutate({ key: flag.key, enabled: !flag.enabled })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${flag.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${flag.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={flag.rolloutPercentage}
                          onBlur={e => {
                            const pct = Math.min(100, Math.max(0, Number(e.target.value)));
                            if (pct !== flag.rolloutPercentage) rolloutMut.mutate({ key: flag.key, pct });
                          }}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(flag.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(flag.key)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">New Feature Flag</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Flag Key <span className="text-red-500">*</span></label>
                <input
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder="e.g. ALGORITHM_V2"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="What does this flag control?"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Rollout %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newRollout}
                  onChange={e => setNewRollout(Number(e.target.value))}
                  className="input w-24"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!newKey.trim() || createMut.isPending}
                className="btn-primary disabled:opacity-50"
              >
                {createMut.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Flag?</h3>
            <p className="text-sm text-gray-600 mb-5">
              Delete <span className="font-mono font-medium">{deleteTarget}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
