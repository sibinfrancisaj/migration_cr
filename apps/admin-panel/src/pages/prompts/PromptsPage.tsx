import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAdminPrompts, createPrompt, updatePrompt } from '@/api/prompts';
import type { AdminPrompt } from '@/api/prompts';

export default function PromptsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [newText, setNewText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-prompts', page],
    queryFn: () => fetchAdminPrompts({ page, limit: 20 }),
  });

  const prompts = data?.prompts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-prompts'] });

  const createMut = useMutation({
    mutationFn: () => createPrompt({ text: newText.trim() }),
    onSuccess: () => { invalidate(); setShowCreate(false); setNewText(''); },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updatePrompt(id, { isActive }),
    onSuccess: invalidate,
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Prompts</h1>
          <p className="text-gray-500 text-sm mt-1">Manage community conversation prompts</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Prompt</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Prompt Text</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">Active</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">Responses</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-28">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>)}</tr>
                ))
              : prompts.length === 0
              ? <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No prompts yet</td></tr>
              : prompts.map((p: AdminPrompt) => (
                  <tr key={p.id} className={`hover:bg-gray-50 ${p.isActive ? 'border-l-4 border-l-amber-400' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-800 leading-snug">{p.text}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActiveMut.mutate({ id: p.id, isActive: !p.isActive })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${p.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.responseCount}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
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

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">New Weekly Prompt</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Text <span className="text-red-500">*</span></label>
              <textarea
                value={newText}
                onChange={e => setNewText(e.target.value)}
                rows={4}
                placeholder="What's a tradition from your culture that you'd love to share with your future partner?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!newText.trim() || createMut.isPending}
                className="btn-primary disabled:opacity-50"
              >
                {createMut.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
