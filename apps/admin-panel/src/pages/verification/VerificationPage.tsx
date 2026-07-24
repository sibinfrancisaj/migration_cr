import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchVerifications,
  fetchVerificationDetail,
  approveVerification,
  rejectVerification,
} from '@/api/verification';
import type { VerificationAdminDto } from '@/types';

const STATUS_TABS = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] as const;

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function VerificationPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('PENDING');
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['verifications', activeTab, cursor],
    queryFn: () => fetchVerifications({ status: activeTab, cursor, limit: 20 }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['verification-detail', selectedId],
    queryFn: () => fetchVerificationDetail(selectedId!),
    enabled: !!selectedId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['verifications'] });
    qc.invalidateQueries({ queryKey: ['verification-detail', selectedId] });
  };

  const approveMut = useMutation({
    mutationFn: () => approveVerification(selectedId!),
    onSuccess: () => { invalidate(); setSelectedId(null); },
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectVerification(selectedId!, rejectReason),
    onSuccess: () => { invalidate(); setSelectedId(null); setShowRejectModal(false); setRejectReason(''); },
  });

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    setCursor(undefined);
    setCursorStack([]);
    setSelectedId(null);
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

  const items = data?.items ?? [];

  return (
    <div className="flex h-full gap-6">
      {/* Main list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Verification Queue</h1>
          <p className="text-gray-500 text-sm mt-1">Review identity document submissions</p>
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
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Doc Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.length === 0
                ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                      No {activeTab.toLowerCase().replace('_', ' ')} verifications
                    </td>
                  </tr>
                )
                : items.map((item: VerificationAdminDto) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`cursor-pointer hover:bg-amber-50 transition-colors ${
                        selectedId === item.id ? 'bg-amber-50 border-l-2 border-amber-500' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">{item.user.profileName ?? '—'}</p>
                        <p className="text-xs text-gray-500">{item.user.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.idDocType}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(item.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-400">{items.length} items</span>
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

      {/* Detail drawer */}
      {selectedId && (
        <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Verification Detail</h2>
            <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>

          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : detail ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* User info */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">User</p>
                <p className="font-medium text-gray-900">{detail.user.profileName ?? 'No profile name'}</p>
                <p className="text-sm text-gray-500">{detail.user.phone}</p>
                {detail.user.email && <p className="text-sm text-gray-500">{detail.user.email}</p>}
              </section>

              {/* Status */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[detail.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {detail.status}
                </span>
                {detail.reviewedAt && (
                  <p className="text-xs text-gray-400 mt-1">Reviewed {new Date(detail.reviewedAt).toLocaleString()}</p>
                )}
                {detail.reviewNote && (
                  <p className="text-xs text-gray-500 mt-1 italic">"{detail.reviewNote}"</p>
                )}
              </section>

              {/* Documents */}
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Documents</p>
                <div className="space-y-2">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">ID Document ({detail.idDocType})</p>
                    <p className="text-xs font-mono text-gray-700 break-all">{detail.idDocS3Key}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Selfie</p>
                    <p className="text-xs font-mono text-gray-700 break-all">{detail.selfieS3Key}</p>
                  </div>
                </div>
              </section>

              {/* Actions */}
              {(detail.status === 'PENDING' || detail.status === 'UNDER_REVIEW') && (
                <section className="pt-2 space-y-2">
                  <button
                    onClick={() => approveMut.mutate()}
                    disabled={approveMut.isPending}
                    className="w-full py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: '#15803d' }}
                  >
                    {approveMut.isPending ? 'Approving…' : '✓ Approve'}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="w-full py-2 rounded-lg text-sm font-medium text-red-700 border border-red-300 hover:bg-red-50 transition-colors"
                  >
                    ✗ Reject
                  </button>
                </section>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Reject Verification</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a reason that will be sent to the user.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Document unclear, please resubmit with better lighting"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMut.mutate()}
                disabled={!rejectReason.trim() || rejectMut.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
