import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminGroups,
  createAdminGroup,
  archiveAdminGroup,
  fetchGroupProposals,
  approveGroupProposal,
  rejectGroupProposal,
} from '@/api/groups';
import type { AdminGroup, GroupProposal } from '@/api/groups';

const GROUP_TYPES = ['REGIONAL', 'CULTURAL', 'PROFESSIONAL', 'INTEREST'] as const;
const TYPE_BADGE: Record<string, string> = {
  REGIONAL: 'bg-blue-100 text-blue-700',
  CULTURAL: 'bg-purple-100 text-purple-700',
  PROFESSIONAL: 'bg-green-100 text-green-700',
  INTEREST: 'bg-orange-100 text-orange-700',
};

type MainTab = 'groups' | 'proposals';

export default function GroupsPage() {
  const qc = useQueryClient();
  const [mainTab, setMainTab] = useState<MainTab>('groups');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'REGIONAL', scope: 'COUNTRY', description: '' });
  const [archiveTarget, setArchiveTarget] = useState<AdminGroup | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['admin-groups', typeFilter, page],
    queryFn: () => fetchAdminGroups({ type: typeFilter || undefined, page, limit: 20 }),
    enabled: mainTab === 'groups',
  });

  const { data: proposals = [], isLoading: propsLoading } = useQuery({
    queryKey: ['group-proposals'],
    queryFn: () => fetchGroupProposals('PENDING'),
    enabled: mainTab === 'proposals',
  });

  const invalidateGroups = () => qc.invalidateQueries({ queryKey: ['admin-groups'] });
  const invalidateProps = () => qc.invalidateQueries({ queryKey: ['group-proposals'] });

  const createMut = useMutation({
    mutationFn: () => createAdminGroup({ name: form.name.trim(), type: form.type, scope: form.scope, description: form.description.trim() || undefined }),
    onSuccess: () => { invalidateGroups(); setShowCreate(false); setForm({ name: '', type: 'REGIONAL', scope: 'COUNTRY', description: '' }); },
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveAdminGroup(id),
    onSuccess: () => { invalidateGroups(); setArchiveTarget(null); },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveGroupProposal(id),
    onSuccess: invalidateProps,
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectGroupProposal(rejectTarget!, rejectReason || undefined),
    onSuccess: () => { invalidateProps(); setRejectTarget(null); setRejectReason(''); },
  });

  const groups = groupsData?.groups ?? [];
  const total = groupsData?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-500 text-sm mt-1">Manage community groups and member proposals</p>
        </div>
        {mainTab === 'groups' && <button onClick={() => setShowCreate(true)} className="btn-primary">+ Create Group</button>}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['groups', 'proposals'] as MainTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${mainTab === tab ? 'text-amber-700 border-b-2 border-amber-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'proposals' ? `Interest Proposals${proposals.length > 0 ? ` (${proposals.length})` : ''}` : 'All Groups'}
          </button>
        ))}
      </div>

      {mainTab === 'groups' && (
        <>
          {/* Type filter */}
          <div className="flex gap-2">
            <button onClick={() => { setTypeFilter(''); setPage(1); }} className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${!typeFilter ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
            {GROUP_TYPES.map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }} className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${typeFilter === t ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t}</button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Group</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Members</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupsLoading
                  ? Array.from({ length: 8 }).map((_, i) => <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>)}</tr>)
                  : groups.length === 0
                  ? <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No groups</td></tr>
                  : groups.map((g: AdminGroup) => (
                      <tr key={g.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-sm text-gray-900">{g.name}</p>
                          <p className="text-xs text-gray-400">{g.scope}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[g.type] ?? 'bg-gray-100 text-gray-600'}`}>{g.type}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.memberCount}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(g.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          {!g.isArchived && <button onClick={() => setArchiveTarget(g)} className="text-xs text-red-500 hover:text-red-700">Archive</button>}
                        </td>
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
        </>
      )}

      {mainTab === 'proposals' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proposed Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Proposer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {propsLoading
                ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>)}</tr>)
                : proposals.length === 0
                ? <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No pending proposals</td></tr>
                : proposals.map((p: GroupProposal) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-gray-900">{p.proposedName}</p>
                        {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-500">{p.proposerId.slice(0, 10)}…</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => approveMut.mutate(p.id)} disabled={approveMut.isPending} className="px-2 py-1 text-xs text-white font-medium rounded disabled:opacity-50" style={{ backgroundColor: '#15803d' }}>Approve</button>
                          <button onClick={() => setRejectTarget(p.id)} className="px-2 py-1 text-xs text-red-600 border border-red-300 hover:bg-red-50 font-medium rounded">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Create Group</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Indians in London" className="input w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input w-full">
                    {GROUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <select value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} className="input w-full">
                    <option value="COUNTRY">Country</option>
                    <option value="GLOBAL">Global</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={!form.name.trim() || createMut.isPending} className="btn-primary disabled:opacity-50">{createMut.isPending ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {archiveTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Archive Group?</h3>
            <p className="text-sm text-gray-600 mb-5">Archive "<strong>{archiveTarget.name}</strong>"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveTarget(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={() => archiveMut.mutate(archiveTarget.id)} disabled={archiveMut.isPending} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">{archiveMut.isPending ? '…' : 'Archive'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject proposal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Reject Proposal</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason (optional)" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4" />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectTarget(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">{rejectMut.isPending ? '…' : 'Reject'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
