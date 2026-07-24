import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUsers, fetchUserDetail,
  suspendUser, unsuspendUser, banUser, wipeSeededUser,
} from '@/api/users';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { UserAdminSummary, UserAdminDetail } from '@/types';

const STATUS_TABS = [
  { label: 'All',       value: '' },
  { label: 'Active',    value: 'USER' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Admin',     value: 'ADMIN' },
  { label: 'Seeded',    value: '__seeded' },
];

export function UsersPage() {
  const qc = useQueryClient();

  // ── List state ────────────────────────────────────────────────────────────
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [cursor, setCursor]     = useState<string | null>(null);
  const [pages, setPages]       = useState<string[]>([]);   // stack of cursors for Back
  const searchRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listKey = ['users', search, status, cursor];
  const listQ = useQuery({
    queryKey: listKey,
    queryFn: () => fetchUsers({
      search: search || undefined,
      status: status === '__seeded' ? undefined : (status || undefined),
      cursor: cursor ?? undefined,
      limit: 25,
    }),
    staleTime: 30_000,
  });

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailQ = useQuery({
    queryKey: ['user-detail', selectedId],
    queryFn: () => fetchUserDetail(selectedId!),
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  // ── Action modal state ────────────────────────────────────────────────────
  const [modal, setModal] = useState<null | 'suspend' | 'ban' | 'wipe'>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');

  const suspendM   = useMutation({ mutationFn: ({ id, r }: { id: string; r: string }) => suspendUser(id, r),   onSuccess: afterAction });
  const unsuspendM = useMutation({ mutationFn: (id: string) => unsuspendUser(id),                               onSuccess: afterAction });
  const banM       = useMutation({ mutationFn: ({ id, r }: { id: string; r: string }) => banUser(id, r),       onSuccess: afterAction });
  const wipeM      = useMutation({ mutationFn: (id: string) => wipeSeededUser(id),                              onSuccess: afterAction });

  function afterAction() {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['user-detail', selectedId] });
    setModal(null);
    setReason('');
    setActionError('');
  }

  function handleSearch(val: string) {
    setSearch(val);
    setCursor(null);
    setPages([]);
    if (searchRef.current) clearTimeout(searchRef.current);
  }

  function handleTab(val: string) {
    setStatus(val);
    setCursor(null);
    setPages([]);
  }

  function nextPage() {
    if (!listQ.data?.nextCursor) return;
    setPages((p) => [...p, cursor ?? '']);
    setCursor(listQ.data!.nextCursor);
  }

  function prevPage() {
    const prev = pages[pages.length - 1] ?? null;
    setPages((p) => p.slice(0, -1));
    setCursor(prev === '' ? null : prev);
  }

  async function handleModalSubmit() {
    if (!selectedId) return;
    setActionError('');
    try {
      if (modal === 'suspend') { if (!reason.trim()) { setActionError('Reason is required'); return; } await suspendM.mutateAsync({ id: selectedId, r: reason }); }
      if (modal === 'ban')     { if (!reason.trim()) { setActionError('Reason is required'); return; } await banM.mutateAsync({ id: selectedId, r: reason }); }
      if (modal === 'wipe')    { await wipeM.mutateAsync(selectedId); }
    } catch {
      setActionError('Action failed — check permissions or try again.');
    }
  }

  const users = (listQ.data?.users ?? []).filter((u) =>
    status === '__seeded' ? u.isSeeded : true,
  );

  return (
    <div className="flex gap-5 h-full">
      {/* ── Main table panel ─────────────────────────────────────────────── */}
      <div className={`flex flex-col min-w-0 flex-1 space-y-4 transition-all ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-stone-500 mt-0.5">Search, inspect, and moderate platform users</p>
        </div>

        {/* Search + tabs */}
        <div className="card p-4 space-y-3">
          <input
            type="text"
            className="input"
            placeholder="Search by phone or email…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTab(t.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  status === t.value
                    ? 'text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
                style={status === t.value ? { backgroundColor: '#d97706' } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {listQ.isError ? (
          <ErrorBanner message="Failed to load users" />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-100">
                  <tr>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-stone-500">User</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-stone-500">Status</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-stone-500 hidden md:table-cell">Profile</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-stone-500 hidden lg:table-cell">Verification</th>
                    <th className="text-right py-2.5 px-4 text-xs font-medium text-stone-500 hidden md:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {listQ.isLoading
                    ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                    : users.map((u) => (
                        <tr
                          key={u.id}
                          className={`border-b border-stone-50 cursor-pointer transition-colors ${
                            selectedId === u.id ? 'bg-amber-50' : 'hover:bg-stone-50'
                          }`}
                          onClick={() => setSelectedId(u.id)}
                        >
                          <td className="py-3 px-4">
                            <p className="font-medium text-stone-900">{u.profile?.name ?? '—'}</p>
                            <p className="text-xs text-stone-400">{u.phone.slice(0, 6)}****</p>
                            {u.isSeeded && (
                              <span className="text-xs bg-violet-50 text-violet-600 border border-violet-200 rounded px-1">bot</span>
                            )}
                          </td>
                          <td className="py-3 px-4"><RoleBadge role={u.role} /></td>
                          <td className="py-3 px-4 text-right hidden md:table-cell">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${u.profile?.completionScore ?? 0}%`,
                                    backgroundColor: (u.profile?.completionScore ?? 0) >= 80 ? '#16a34a' : '#d97706',
                                  }}
                                />
                              </div>
                              <span className="text-xs text-stone-500 w-8 text-right">
                                {u.profile?.completionScore ?? 0}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 hidden lg:table-cell">
                            <VerifBadge status={u.profile?.verificationStatus ?? 'PENDING'} />
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-stone-400 hidden md:table-cell">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
              <span className="text-xs text-stone-400">
                {users.length} users{listQ.data?.hasMore ? ' (more available)' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={prevPage}
                  disabled={pages.length === 0}
                  className="px-3 py-1 text-xs rounded border border-stone-200 text-stone-600 disabled:opacity-40 hover:bg-stone-50"
                >
                  ← Prev
                </button>
                <button
                  onClick={nextPage}
                  disabled={!listQ.data?.hasMore}
                  className="px-3 py-1 text-xs rounded border border-stone-200 text-stone-600 disabled:opacity-40 hover:bg-stone-50"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
      {selectedId && (
        <div className="flex flex-col w-full lg:w-96 xl:w-[420px] flex-shrink-0 space-y-4">
          {/* Drawer header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900">User Detail</h2>
            <button
              onClick={() => setSelectedId(null)}
              className="text-stone-400 hover:text-stone-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {detailQ.isLoading ? (
            <div className="card p-8 flex justify-center"><Spinner /></div>
          ) : detailQ.isError ? (
            <ErrorBanner message="Failed to load user detail" />
          ) : detailQ.data ? (
            <DetailPanel
              detail={detailQ.data}
              onSuspend={() => { setModal('suspend'); setReason(''); }}
              onUnsuspend={() => unsuspendM.mutate(selectedId)}
              onBan={() => { setModal('ban'); setReason(''); }}
              onWipe={() => setModal('wipe')}
              unsuspendLoading={unsuspendM.isPending}
            />
          ) : null}
        </div>
      )}

      {/* ── Action modal ──────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-stone-900 mb-1">
              {modal === 'suspend' ? 'Suspend User' : modal === 'ban' ? 'Ban User' : 'Wipe Seeded Data'}
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              {modal === 'suspend' && 'The user will lose access until unsuspended.'}
              {modal === 'ban'     && 'All tokens will be revoked. This cannot be undone.'}
              {modal === 'wipe'    && 'All seeded profile data for this bot will be deleted permanently.'}
            </p>

            {(modal === 'suspend' || modal === 'ban') && (
              <div className="mb-4">
                <label className="label">Reason</label>
                <textarea
                  className="input resize-none h-20"
                  placeholder="Enter reason…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            )}

            {actionError && (
              <p className="text-sm text-red-600 mb-3">{actionError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setModal(null); setActionError(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                disabled={suspendM.isPending || banM.isPending || wipeM.isPending}
                className="btn-danger disabled:opacity-50"
              >
                {suspendM.isPending || banM.isPending || wipeM.isPending ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  detail,
  onSuspend,
  onUnsuspend,
  onBan,
  onWipe,
  unsuspendLoading,
}: {
  detail: UserAdminDetail;
  onSuspend: () => void;
  onUnsuspend: () => void;
  onBan: () => void;
  onWipe: () => void;
  unsuspendLoading: boolean;
}) {
  const isSuspended = detail.role === 'SUSPENDED';

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
          >
            {detail.profile?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-stone-900 truncate">{detail.profile?.name ?? 'No profile'}</p>
            <p className="text-xs text-stone-400">{detail.phone.slice(0, 6)}****</p>
          </div>
          <div className="ml-auto flex-shrink-0">
            <RoleBadge role={detail.role} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <DetailRow label="User ID"     value={detail.id.slice(0, 8) + '…'} />
          <DetailRow label="Joined"      value={new Date(detail.createdAt).toLocaleDateString()} />
          <DetailRow label="Email"       value={detail.email ?? '—'} />
          <DetailRow label="Seeded bot"  value={detail.isSeeded ? 'Yes' : 'No'} />
        </div>
      </div>

      {/* Profile scores */}
      <div className="card p-4 space-y-2">
        <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Profile</p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>Completion</span>
              <span className="font-medium">{detail.profile?.completionScore ?? 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${detail.profile?.completionScore ?? 0}%`,
                  backgroundColor: (detail.profile?.completionScore ?? 0) >= 80 ? '#16a34a' : '#d97706',
                }}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <DetailRow label="Verification" value={<VerifBadge status={detail.verificationStatus} />} />
          <DetailRow label="Open Flags"   value={
            <span className={`font-semibold ${detail.openFlagCount > 0 ? 'text-red-600' : 'text-stone-700'}`}>
              {detail.openFlagCount}
            </span>
          } />
        </div>
      </div>

      {/* Membership */}
      <div className="card p-4 space-y-2">
        <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Membership</p>
        {detail.membership ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <DetailRow label="Plan"    value={detail.membership.plan} />
            <DetailRow label="Status"  value={detail.membership.status} />
            <DetailRow label="Expires" value={detail.membership.expiresAt ? new Date(detail.membership.expiresAt).toLocaleDateString() : 'N/A'} />
          </div>
        ) : (
          <p className="text-xs text-stone-400">No active membership</p>
        )}
      </div>

      {/* Devices */}
      <div className="card p-4 space-y-2">
        <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
          Devices ({detail.devices.length})
        </p>
        {detail.devices.length === 0 ? (
          <p className="text-xs text-stone-400">No devices</p>
        ) : (
          <div className="space-y-1.5">
            {detail.devices.slice(0, 3).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="text-stone-500 font-mono">{d.fingerprint.slice(0, 12)}…</span>
                <span className="text-stone-400">
                  {d.lastUsedAt ? new Date(d.lastUsedAt).toLocaleDateString() : 'Never'}
                </span>
              </div>
            ))}
            {detail.devices.length > 3 && (
              <p className="text-xs text-stone-400">+{detail.devices.length - 3} more</p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card p-4 space-y-2">
        <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Actions</p>
        <div className="space-y-2">
          {isSuspended ? (
            <button
              onClick={onUnsuspend}
              disabled={unsuspendLoading}
              className="w-full btn-secondary justify-center disabled:opacity-50"
            >
              {unsuspendLoading ? 'Processing…' : 'Unsuspend User'}
            </button>
          ) : (
            <button onClick={onSuspend} className="w-full btn-secondary justify-center text-amber-700 border-amber-200 hover:bg-amber-50">
              Suspend User
            </button>
          )}
          {!isSuspended && (
            <button onClick={onBan} className="w-full btn-danger justify-center">
              Ban User
            </button>
          )}
          {detail.isSeeded && (
            <button onClick={onWipe} className="w-full btn-secondary justify-center text-violet-700 border-violet-200 hover:bg-violet-50">
              Wipe Bot Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    USER:       { bg: '#f0fdf4', text: '#16a34a', label: 'Active' },
    SUSPENDED:  { bg: '#fef2f2', text: '#dc2626', label: 'Suspended' },
    ADMIN:      { bg: '#fffbeb', text: '#d97706', label: 'Admin' },
    SUPERADMIN: { bg: '#fef3c7', text: '#b45309', label: 'Superadmin' },
    MODERATOR:  { bg: '#f0f9ff', text: '#0284c7', label: 'Moderator' },
  };
  const s = map[role] ?? { bg: '#f5f5f5', text: '#737373', label: role };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function VerifBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    APPROVED:     { color: '#16a34a', label: '✓ Verified' },
    PENDING:      { color: '#d97706', label: '⏳ Pending' },
    UNDER_REVIEW: { color: '#0284c7', label: '🔍 In Review' },
    REJECTED:     { color: '#dc2626', label: '✗ Rejected' },
  };
  const s = map[status] ?? { color: '#737373', label: status };
  return <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-stone-400 mb-0.5">{label}</p>
      <div className="text-stone-700 font-medium">{value}</div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-stone-50 animate-pulse">
      <td className="py-3 px-4"><div className="h-4 bg-stone-100 rounded w-32 mb-1" /><div className="h-3 bg-stone-100 rounded w-20" /></td>
      <td className="py-3 px-4"><div className="h-5 bg-stone-100 rounded-full w-16" /></td>
      <td className="py-3 px-4 hidden md:table-cell"><div className="h-2 bg-stone-100 rounded w-20 ml-auto" /></td>
      <td className="py-3 px-4 hidden lg:table-cell"><div className="h-4 bg-stone-100 rounded w-16" /></td>
      <td className="py-3 px-4 hidden md:table-cell"><div className="h-3 bg-stone-100 rounded w-16 ml-auto" /></td>
    </tr>
  );
}
