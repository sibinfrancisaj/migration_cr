import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAdminEvents, createEvent, archiveEvent } from '@/api/events';
import type { AdminEvent } from '@/api/events';

export default function EventsPage() {
  const qc = useQueryClient();
  const [upcoming, setUpcoming] = useState(true);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', startAt: '', endAt: '', location: '', tags: '' });
  const [archiveTarget, setArchiveTarget] = useState<AdminEvent | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-events', upcoming, page],
    queryFn: () => fetchAdminEvents({ upcoming, page, limit: 20 }),
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-events'] });

  const createMut = useMutation({
    mutationFn: () => createEvent({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startAt: form.startAt,
      endAt: form.endAt || undefined,
      location: form.location.trim() || undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    }),
    onSuccess: () => { invalidate(); setShowCreate(false); setForm({ title: '', description: '', startAt: '', endAt: '', location: '', tags: '' }); },
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveEvent(id),
    onSuccess: () => { invalidate(); setArchiveTarget(null); },
  });

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <p className="text-gray-500 text-sm mt-1">Manage gatherings and community events</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ Create Event</button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {[{ label: 'Upcoming', val: true }, { label: 'Past / Archived', val: false }].map(tab => (
            <button
              key={String(tab.val)}
              onClick={() => { setUpcoming(tab.val); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${upcoming === tab.val ? 'text-amber-700 border-b-2 border-amber-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Starts</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">RSVPs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tags</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>)}</tr>
                  ))
                : events.length === 0
                ? <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No events</td></tr>
                : events.map((ev: AdminEvent) => (
                    <tr key={ev.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">{ev.title}</p>
                        {ev.location && <p className="text-xs text-gray-400">{ev.location}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(ev.startAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{ev.rsvpCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {ev.tags.slice(0, 3).map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!ev.isArchived && (
                          <button onClick={() => setArchiveTarget(ev)} className="text-xs text-red-500 hover:text-red-700">Archive</button>
                        )}
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
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Create Event</h3>
            <div className="space-y-3">
              {[
                { label: 'Title *', key: 'title', type: 'text', placeholder: 'Event title' },
                { label: 'Start Date/Time *', key: 'startAt', type: 'datetime-local', placeholder: '' },
                { label: 'End Date/Time', key: 'endAt', type: 'datetime-local', placeholder: '' },
                { label: 'Location', key: 'location', type: 'text', placeholder: 'e.g. London, UK or Online' },
                { label: 'Tags (comma-separated)', key: 'tags', type: 'text', placeholder: 'e.g. social, diaspora' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="input w-full text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!form.title.trim() || !form.startAt || createMut.isPending}
                className="btn-primary disabled:opacity-50"
              >
                {createMut.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {archiveTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Archive Event?</h3>
            <p className="text-sm text-gray-600 mb-5">Archive "<strong>{archiveTarget.title}</strong>"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveTarget(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button
                onClick={() => archiveMut.mutate(archiveTarget.id)}
                disabled={archiveMut.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {archiveMut.isPending ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
