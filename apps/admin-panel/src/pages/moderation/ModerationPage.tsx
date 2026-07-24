import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFlags, resolveFlag } from '@/api/moderation';
import type { FlagItem } from '@/types';

const STATUS_TABS = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;
type TabType = typeof STATUS_TABS[number];

const ACTION_OPTIONS = [
  { value: 'MESSAGE_REMOVED', label: 'Remove Message' },
  { value: 'USER_WARNED', label: 'Warn User' },
  { value: 'USER_SUSPENDED', label: 'Suspend User' },
  { value: 'NO_ACTION', label: 'No Action Required' },
  { value: 'DISMISSED', label: 'Dismiss Flag' },
];

const REASON_BADGE: Record<string, string> = {
  SPAM: 'bg-yellow-100 text-yellow-700',
  HARASSMENT: 'bg-red-100 text-red-700',
  INAPPROPRIATE_CONTENT: 'bg-orange-100 text-orange-700',
  HATE_SPEECH: 'bg-red-100 text-red-800',
  MISINFORMATION: 'bg-purple-100 text-purple-700',
  OTHER: 'bg-gray-100 text-gray-600',
};

export default function ModerationPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('OPEN');
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [selected, setSelected] = useState<FlagItem | null>(null);
  const [actionTaken, setActionTaken] = useState('');
  const [resolution, setResolution] = useState('');
  const [resolveStatus, setResolveStatus] = useState<'RESOLVED' | 'DISMISSED'>('RESOLVED');
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['flags', activeTab, cursor],
    queryFn: () => fetchFlags({ status: activeTab, cursor, limit: 25 }),
  });

  const resolveMut = useMutation({
    mutationFn: () =>
      resolveFlag(selected!.id, {
        status: resolveStatus,
        actionTaken: actionTaken || undefined,
        resolution: resolution || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flags'] });
      setShowModal(false);
      setSelected(null);
      setActionTaken('');
      setResolution('');
    },
  });

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setCursor(undefined);
    setCursorStack([]);
    setSelected(null);
  };

  const nextPage = () => {
    if (data?.nextCursor) {
      setCursorStack(s => [...s, cursor]);
      setCursor(data.nextCursor ?? undefined);
    }
  };

  const prevPage = () => {
    const stack = [...cursorStack];
    const prev = stack.pop();
    setCursorStack(stack);
    setCursor(prev);
  };

  const flags = data?.flags ?? [];

  const openResolveModal = (flag: FlagItem, status: 'RESOLVED' | 'DISMISSED') => {
    setSelected(flag);
    setResolveStatus(status);
    setActionTaken('');
    setResolution('');
    setShowModal(true);
  };

  return (
    <div className="flex h-full gap-6">
      {/* Main list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>
          <p className="text-gray-500 text-sm mt-1">Review and resolve reported content flags</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'text-amber-700 border-b-2 border-amber-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reporter</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Target</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Flagged</th>
                {activeTab === 'OPEN' && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : flags.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      No {activeTab.toLowerCase()} flags
                    </td>
                  </tr>
                )
                : flags.map((flag: FlagItem) => (
                    <tr
                      key={flag.id}
                      onClick={() => setSelected(flag)}
                      className={`cursor-pointer hover:bg-amber-50 transition-colors ${
                        selected?.id === flag.id ? 'bg-amber-50 border-l-2 border-amber-500' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REASON_BADGE[flag.reason] ?? 'bg-gray-100 text-gray-600'}`}>
                          {flag.reason.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{flag.reporterId.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{flag.targetEntityId.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(flag.createdAt).toLocaleDateString()}</td>
                      {activeTab === 'OPEN' && (
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openResolveModal(flag, 'RESOLVED')}
                              className="px-2 py-1 text-xs rounded text-white font-medium transition-colors"
                              style={{ backgroundColor: '#15803d' }}
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => openResolveModal(flag, 'DISMISSED')}
                              className="px-2 py-1 text-xs rounded text-gray-600 border border-gray-300 hover:bg-gray-50 font-medium"
                            >
                              Dismiss
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-400">{flags.length} items</span>
            <div className="flex gap-2">
              <button
                onClick={prevPage}
                disabled={cursorStack.length === 0}
                className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                onClick={nextPage}
                disabled={!data?.hasMore}
                className="px-3 py-1 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Side detail panel */}
      {selected && (
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Flag Detail</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Reason</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REASON_BADGE[selected.reason] ?? 'bg-gray-100 text-gray-600'}`}>
                {selected.reason.replace(/_/g, ' ')}
              </span>
            </div>
            {selected.description && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Description</p>
                <p className="text-sm text-gray-700">{selected.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Reporter ID</p>
              <p className="text-xs font-mono text-gray-600">{selected.reporterId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Target Entity</p>
              <p className="text-xs font-mono text-gray-600">{selected.targetEntityId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Status</p>
              <p className="text-sm text-gray-700">{selected.status}</p>
            </div>
            {selected.actionTaken && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Action Taken</p>
                <p className="text-sm text-gray-700">{selected.actionTaken.replace(/_/g, ' ')}</p>
              </div>
            )}
            {selected.resolution && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Resolution Note</p>
                <p className="text-sm text-gray-700">{selected.resolution}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Flagged</p>
              <p className="text-xs text-gray-500">{new Date(selected.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Resolve modal */}
      {showModal && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-1">
              {resolveStatus === 'DISMISSED' ? 'Dismiss Flag' : 'Resolve Flag'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Flag ID: <span className="font-mono">{selected.id.slice(0, 12)}…</span>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Taken</label>
              <select
                value={actionTaken}
                onChange={e => setActionTaken(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select action…</option>
                {ACTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Note (optional)</label>
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                placeholder="Internal note about this decision…"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => resolveMut.mutate()}
                disabled={resolveMut.isPending}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
                style={{ backgroundColor: resolveStatus === 'DISMISSED' ? '#6b7280' : '#d97706' }}
              >
                {resolveMut.isPending
                  ? 'Saving…'
                  : resolveStatus === 'DISMISSED'
                  ? 'Dismiss'
                  : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
