import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAdminDrops, approveDrop, scheduleDrop, proposeNewDrop } from '@/api/introductions';
import type { AdminDrop } from '@/api/introductions';

const STATUS_TABS = ['DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'LIVE', 'EXPIRED'] as const;
const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  LIVE: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-red-100 text-red-600',
};

export default function IntroductionsPage() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState('PENDING_APPROVAL');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminDrop | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [form, setForm] = useState({ title: '', theme: '', earlyAccessCost: '50', unlockCost: '200' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-drops', statusTab, page],
    queryFn: () => fetchAdminDrops({ status: statusTab, page, limit: 20 }),
  });

  const drops = data?.drops ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-drops'] });
    setSelected(null);
  };

  const approveMut = useMutation({
    mutationFn: (id: string) => approveDrop(id),
    onSuccess: invalidate,
  });

  const scheduleMut = useMutation({
    mutationFn: () => scheduleDrop(selected!.id, new Date(scheduleDate).toISOString()),
    onSuccess: () => { invalidate(); setShowSchedule(false); setScheduleDate(''); },
  });

  const createMut = useMutation({
    mutationFn: () => proposeNewDrop({
      title: form.title.trim(),
      theme: form.theme.trim() || undefined,
      earlyAccessCost: Number(form.earlyAccessCost),
      unlockCost: Number(form.unlockCost),
    }),
    onSuccess: () => { invalidate(); setShowCreate(false); setForm({ title: '', theme: '', earlyAccessCost: '50', unlockCost: '200' }); },
  });

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Introduction Drops</h1>
            <p className="text-gray-500 text-sm mt-1">Manage curated AI-powered introduction events</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ Propose Drop</button>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setStatusTab(tab); setPage(1); setSelected(null); }}
              className={`px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors ${statusTab === tab ? 'text-amber-700 border-b-2 border-amber-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Drop</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Members</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pairs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Release</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>)}</tr>)
                : drops.length === 0
                ? <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No {statusTab.toLowerCase().replace('_', ' ')} drops</td></tr>
                : drops.map((d: AdminDrop) => (
                    <tr key={d.id} onClick={() => setSelected(d)} className={`cursor-pointer hover:bg-amber-50 transition-colors ${selected?.id === d.id ? 'bg-amber-50 border-l-2 border-amber-500' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-gray-900">{d.title}</p>
                        {d.theme && <p className="text-xs text-gray-400">{d.theme}</p>}
                      </td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[d.status] ?? 'bg-gray-100 text-gray-600'}`}>{d.status.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.memberCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.pairingCount}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{d.releaseAt ? new Date(d.releaseAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-400">{total} total</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Drop Detail</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="font-semibold text-gray-900">{selected.title}</p>
            {selected.theme && <p className="text-sm text-gray-500">{selected.theme}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-700">{selected.memberCount}</p>
                <p className="text-xs text-gray-500">Members</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-700">{selected.pairingCount}</p>
                <p className="text-xs text-gray-500">Pairs</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[selected.status] ?? ''}`}>{selected.status.replace('_', ' ')}</span>
            </div>
            {selected.releaseAt && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Release</p>
                <p className="text-sm text-gray-700">{new Date(selected.releaseAt).toLocaleString()}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {selected.status === 'PENDING_APPROVAL' && (
                <button onClick={() => approveMut.mutate(selected.id)} disabled={approveMut.isPending} className="w-full py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: '#15803d' }}>
                  {approveMut.isPending ? 'Approving…' : '✓ Approve Drop'}
                </button>
              )}
              {(selected.status === 'DRAFT' || selected.status === 'PENDING_APPROVAL' || selected.status === 'SCHEDULED') && (
                <button onClick={() => setShowSchedule(true)} className="w-full py-2 text-sm font-medium rounded-lg border border-amber-400 text-amber-700 hover:bg-amber-50">
                  Set Release Date
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule modal */}
      {showSchedule && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Schedule Drop: {selected.title}</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">Release Date & Time</label>
            <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="input w-full mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowSchedule(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={() => scheduleMut.mutate()} disabled={!scheduleDate || scheduleMut.isPending} className="btn-primary disabled:opacity-50">{scheduleMut.isPending ? 'Saving…' : 'Schedule'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Propose New Drop</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Diwali Season Introductions" className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
                <input value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} placeholder="e.g. UK-based professionals" className="input w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Early Access Cost (💎)</label>
                  <input type="number" min={0} value={form.earlyAccessCost} onChange={e => setForm(f => ({ ...f, earlyAccessCost: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unlock Cost (💎)</label>
                  <input type="number" min={0} value={form.unlockCost} onChange={e => setForm(f => ({ ...f, unlockCost: e.target.value }))} className="input w-full" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={!form.title.trim() || createMut.isPending} className="btn-primary disabled:opacity-50">{createMut.isPending ? 'Creating…' : 'Propose'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
