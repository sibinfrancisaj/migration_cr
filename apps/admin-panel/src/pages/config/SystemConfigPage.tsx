import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSystemConfig,
  upsertSystemConfig,
  createSystemConfig,
  deleteSystemConfig,
} from '@/api/systemConfig';
import type { SystemConfigEntry } from '@/api/systemConfig';

export default function SystemConfigPage() {
  const qc = useQueryClient();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: fetchSystemConfig,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['system-config'] });

  const upsertMut = useMutation({
    mutationFn: () => upsertSystemConfig(editKey!, editValue),
    onSuccess: () => { invalidate(); setEditKey(null); },
  });

  const createMut = useMutation({
    mutationFn: () => createSystemConfig({ key: newKey.trim(), value: newValue.trim(), description: newDesc.trim() || undefined }),
    onSuccess: () => { invalidate(); setShowCreate(false); setNewKey(''); setNewValue(''); setNewDesc(''); },
  });

  const deleteMut = useMutation({
    mutationFn: (key: string) => deleteSystemConfig(key),
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  const startEdit = (entry: SystemConfigEntry) => {
    setEditKey(entry.key);
    setEditValue(entry.value);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Config</h1>
          <p className="text-gray-500 text-sm mt-1">Admin-configurable key-value settings</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Key</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-64">Key</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Value</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">Updated</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              : entries.length === 0
              ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400">No config entries</td>
                </tr>
              )
              : entries.map((entry: SystemConfigEntry) => (
                  <tr key={entry.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-medium text-gray-900">{entry.key}</p>
                        {entry.isProtected && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">protected</span>
                        )}
                      </div>
                      {entry.description && <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {editKey === entry.key ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="input flex-1 text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => upsertMut.mutate()}
                            disabled={upsertMut.isPending}
                            className="px-2 py-1 text-xs font-medium text-white rounded"
                            style={{ backgroundColor: '#d97706' }}
                          >
                            {upsertMut.isPending ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditKey(null)} className="text-xs text-gray-500">✕</button>
                        </div>
                      ) : (
                        <span className="font-mono text-sm text-gray-700">{entry.value}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(entry.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => startEdit(entry)} className="text-xs text-amber-600 hover:text-amber-800">Edit</button>
                        {!entry.isProtected && (
                          <button onClick={() => setDeleteTarget(entry.key)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        )}
                      </div>
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
            <h3 className="font-semibold text-gray-900 mb-4">New Config Key</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key <span className="text-red-500">*</span></label>
                <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="e.g. SUGGESTED_GROUPS_MAX" className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value <span className="text-red-500">*</span></label>
                <input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="e.g. 20" className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What does this control?" className="input w-full" />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!newKey.trim() || !newValue.trim() || createMut.isPending}
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
            <h3 className="font-semibold text-gray-900 mb-2">Delete Config?</h3>
            <p className="text-sm text-gray-600 mb-5">Delete <span className="font-mono font-medium">{deleteTarget}</span>?</p>
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
