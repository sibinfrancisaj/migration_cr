import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSeederStatus, flushSeeder } from '@/api/seeder';

export default function SeederPage() {
  const qc = useQueryClient();
  const [showFlushConfirm, setShowFlushConfirm] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['seeder-status'],
    queryFn: fetchSeederStatus,
    refetchInterval: 10_000,
  });

  const flushMut = useMutation({
    mutationFn: flushSeeder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seeder-status'] });
      setShowFlushConfirm(false);
    },
  });

  const stats = [
    { label: 'Total Profiles Created', value: data?.totalProfilesCreated ?? '—' },
    { label: 'Seeded Users in DB', value: data?.seededUserCount ?? '—' },
    { label: 'Seeded Profiles in DB', value: data?.seededProfileCount ?? '—' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Seeder & Bot Control</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor and control the automated data seeder</p>
      </div>

      {/* Status card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-800">Live Status</h2>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <span className="text-xs text-gray-400">Loading…</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${data?.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                <span className={`text-sm font-medium ${data?.isRunning ? 'text-green-700' : 'text-gray-500'}`}>
                  {data?.isRunning ? 'Running' : 'Idle'}
                </span>
              </div>
            )}
            <button
              onClick={() => refetch()}
              className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Drip status */}
        <div className="mb-5 flex items-center gap-3">
          <span className="text-sm text-gray-600">Drip scheduler:</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${data?.dripPaused ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
            {data?.dripPaused ? 'Paused' : 'Active'}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {stats.map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Last run timestamps */}
        <div className="space-y-1 text-sm text-gray-500">
          <p>Last full run: <span className="text-gray-700">{data?.lastRunAt ? new Date(data.lastRunAt).toLocaleString() : '—'}</span></p>
          <p>Last drip: <span className="text-gray-700">{data?.lastDripAt ? new Date(data.lastDripAt).toLocaleString() : '—'}</span></p>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Actions</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50">
            <div>
              <p className="font-medium text-red-900 text-sm">Flush All Seeded Data</p>
              <p className="text-xs text-red-600 mt-0.5">Permanently deletes all records where isSeeded = true. Cannot be undone.</p>
            </div>
            <button
              onClick={() => setShowFlushConfirm(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Flush
            </button>
          </div>
        </div>
      </div>

      {/* Flush confirmation modal */}
      {showFlushConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Flush All Seeded Data?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete <strong>{data?.seededUserCount ?? 0}</strong> seeded users and all their associated data.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowFlushConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => flushMut.mutate()}
                disabled={flushMut.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {flushMut.isPending ? 'Flushing…' : 'Yes, Flush Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
