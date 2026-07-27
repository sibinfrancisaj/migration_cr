import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SocialLoopSnapshot, DripSnapshot } from '@/types';
import {
  fetchSeederStatus, flushSeeder,
  triggerDrip, triggerActivity,
  pauseDrip, resumeDrip,
  pauseActivity, resumeActivity,
  seedGroups,
} from '@/api/seeder';

type Tab = 'overview' | 'workflows' | 'activity';

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function dur(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function relTime(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
      {label}
    </span>
  );
}

function ActionBtn({
  onClick, disabled, danger, children,
}: { onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed
        ${danger
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
    >
      {children}
    </button>
  );
}

function SocialLoopCard({ snap }: { snap: SocialLoopSnapshot }) {
  const totalReactive = snap.connectionsHandled + snap.introsHandled + snap.postsLiked + snap.commentsAdded + snap.responsesResonated;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{fmt(snap.ranAt)}</span>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>{snap.usersActive} bots active</span>
          <span>{dur(snap.durationMs)}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Connections', value: snap.connectionsHandled, color: 'text-blue-700' },
          { label: 'Intros', value: snap.introsHandled, color: 'text-purple-700' },
          { label: 'Posts liked', value: snap.postsLiked, color: 'text-pink-700' },
          { label: 'Comments', value: snap.commentsAdded, color: 'text-green-700' },
          { label: 'Resonated', value: snap.responsesResonated, color: 'text-indigo-700' },
          { label: 'Proactive', value: snap.totalProactive, color: 'text-amber-700' },
        ].map(item => (
          <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
        <span>Total reactive: <strong className="text-gray-800">{totalReactive}</strong></span>
        <span>Total proactive: <strong className="text-gray-800">{snap.totalProactive}</strong></span>
      </div>
    </div>
  );
}

function DripCard({ snap }: { snap: DripSnapshot }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-700">{fmt(snap.ranAt)}</p>
        <p className="text-xs text-gray-500 mt-0.5">{dur(snap.durationMs)}</p>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-amber-700">+{snap.profilesCreated}</p>
        <p className="text-[10px] text-gray-500">profiles created</p>
      </div>
    </div>
  );
}

export default function SeederPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const qc = useQueryClient();

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: status, isLoading } = useQuery({
    queryKey: ['seeder-status'],
    queryFn: fetchSeederStatus,
    refetchInterval: 8_000,
  });

  function makeMut(fn: () => Promise<void>, successMsg: string) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMutation({
      mutationFn: fn,
      onSuccess: () => { qc.invalidateQueries({ queryKey: ['seeder-status'] }); showToast(successMsg, true); },
      onError: (err: Error) => showToast(err.message ?? 'Action failed', false),
    });
  }

  const triggerDripMut = makeMut(triggerDrip, 'Drip job queued');
  const triggerActMut  = makeMut(triggerActivity, 'Activity loop queued');
  const pauseDripMut   = makeMut(pauseDrip, 'Drip paused');
  const resumeDripMut  = makeMut(resumeDrip, 'Drip resumed');
  const pauseActMut    = makeMut(pauseActivity, 'Activity paused');
  const resumeActMut   = makeMut(resumeActivity, 'Activity resumed');
  const seedGroupsMut  = makeMut(seedGroups, 'System groups seeded');
  const flushMut       = makeMut(flushSeeder, 'All seeded data flushed');

  const counts = status?.seededCounts;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'workflows', label: 'Workflows' },
    { id: 'activity', label: 'Activity Log' },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Workflows</h1>
        <p className="text-gray-500 text-sm mt-1">Monitor and control automated seeder workflows — drip seeder, social loop, match recompute</p>
      </div>

      {/* Live status bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-3 flex flex-wrap gap-5 items-center">
        {isLoading
          ? <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
          : (
            <>
              <StatusDot active={!!status?.running} label={status?.running ? 'Drip running' : 'Drip idle'} />
              <StatusDot active={!!status?.activityRunning} label={status?.activityRunning ? 'Activity running' : 'Activity idle'} />
              {status?.dripPaused && <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Drip paused</span>}
              {status?.activityPaused && <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">Activity paused</span>}
              <span className="ml-auto text-xs text-gray-400">Auto-refreshes every 8s</span>
            </>
          )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px
              ${tab === t.id
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Seeded Data Counts</h2>
            {isLoading
              ? <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}</div>
              : (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Users', value: counts?.users ?? 0 },
                    { label: 'Profiles', value: counts?.profiles ?? 0 },
                    { label: 'Groups', value: counts?.groups ?? 0 },
                    { label: 'Group Posts', value: counts?.groupPosts ?? 0 },
                    { label: 'Members', value: counts?.groupMemberships ?? 0 },
                    { label: 'Connections', value: counts?.connections ?? 0 },
                    { label: 'Introductions', value: counts?.introductions ?? 0 },
                    { label: 'Habit Logs', value: counts?.habitLogs ?? 0 },
                    { label: 'Prompt Replies', value: counts?.promptResponses ?? 0 },
                    { label: 'Saved Profiles', value: counts?.savedProfiles ?? 0 },
                    { label: 'Event RSVPs', value: counts?.eventRsvps ?? 0 },
                  ].map(item => (
                    <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700">{item.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Last Run Times</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Last drip', value: status?.lastDripAt ?? null },
                { label: 'Last activity', value: status?.lastActivityAt ?? null },
                { label: 'Last match recompute', value: status?.lastMatchRecomputeAt ?? null },
              ].map(r => (
                <div key={r.label}>
                  <p className="text-xs text-gray-500">{r.label}</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">
                    {fmt(r.value)} <span className="text-xs text-gray-400">({relTime(r.value)})</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-red-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-1">Flush All Seeded Data</h2>
            <p className="text-xs text-gray-500 mb-4">Permanently deletes all synthetic users, profiles, posts, connections, and activity. Irreversible.</p>
            <ActionBtn
              onClick={() => { if (window.confirm('Delete ALL seeded data? This cannot be undone.')) flushMut.mutate(); }}
              danger
              disabled={flushMut.isPending}
            >
              {flushMut.isPending ? 'Flushing…' : 'Flush All Seeded Data'}
            </ActionBtn>
          </div>
        </div>
      )}

      {/* ── Workflows tab ── */}
      {tab === 'workflows' && (
        <div className="space-y-5">

          {/* Drip workflow */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>🌱 Drip Seeder</span>
                  <StatusDot active={!!status?.running} label={status?.running ? 'Running' : status?.dripPaused ? 'Paused' : 'Idle'} />
                </h2>
                <p className="text-xs text-gray-500 mt-1">Creates 3–5 new synthetic profiles at a random offset within a 3–4 hour window for organic feel</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <ActionBtn onClick={() => triggerDripMut.mutate()} disabled={triggerDripMut.isPending || status?.running}>
                  ▶ Run Now
                </ActionBtn>
                {status?.dripPaused
                  ? <ActionBtn onClick={() => resumeDripMut.mutate()} disabled={resumeDripMut.isPending}>Resume</ActionBtn>
                  : <ActionBtn onClick={() => pauseDripMut.mutate()} disabled={pauseDripMut.isPending}>Pause</ActionBtn>}
              </div>
            </div>

            {status?.lastDrip && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Last Run</p>
                <div className="flex items-center gap-6 bg-amber-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-2xl font-bold text-amber-700">+{status.lastDrip.profilesCreated}</p>
                    <p className="text-xs text-gray-500">profiles created</p>
                  </div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    <p>Duration: <strong>{dur(status.lastDrip.durationMs)}</strong></p>
                    <p>At: <strong>{fmt(status.lastDrip.ranAt)}</strong></p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm font-bold text-gray-700">{(status.totalProfilesCreated ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">total created this session</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Social loop workflow */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <span>🤖 Social Loop (Bot Activity)</span>
                  <StatusDot active={!!status?.activityRunning} label={status?.activityRunning ? 'Running' : status?.activityPaused ? 'Paused' : 'Idle'} />
                </h2>
                <p className="text-xs text-gray-500 mt-1">Bots react to events (connections, intros, posts), then initiate organic activity. Runs every 2 hours.</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <ActionBtn onClick={() => triggerActMut.mutate()} disabled={triggerActMut.isPending || status?.activityRunning}>
                  ▶ Run Now
                </ActionBtn>
                {status?.activityPaused
                  ? <ActionBtn onClick={() => resumeActMut.mutate()} disabled={resumeActMut.isPending}>Resume</ActionBtn>
                  : <ActionBtn onClick={() => pauseActMut.mutate()} disabled={pauseActMut.isPending}>Pause</ActionBtn>}
              </div>
            </div>

            {status?.lastSocialLoop && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Last Run — {relTime(status.lastSocialLoop.ranAt)}</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Bots active', value: status.lastSocialLoop.usersActive, color: 'text-blue-700' },
                    { label: 'Connections handled', value: status.lastSocialLoop.connectionsHandled, color: 'text-indigo-700' },
                    { label: 'Intros handled', value: status.lastSocialLoop.introsHandled, color: 'text-purple-700' },
                    { label: 'Posts liked', value: status.lastSocialLoop.postsLiked, color: 'text-pink-700' },
                    { label: 'Comments added', value: status.lastSocialLoop.commentsAdded, color: 'text-green-700' },
                    { label: 'Resonated', value: status.lastSocialLoop.responsesResonated, color: 'text-teal-700' },
                    { label: 'Proactive actions', value: status.lastSocialLoop.totalProactive, color: 'text-amber-700' },
                    { label: 'Duration', value: dur(status.lastSocialLoop.durationMs), color: 'text-gray-700' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className={`text-xl font-bold ${item.color}`}>
                        {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!status?.lastSocialLoop && !isLoading && (
              <p className="text-sm text-gray-400 italic">No activity runs recorded yet. Trigger a run to see stats here.</p>
            )}
          </div>

          {/* System groups */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-800">🏘️ System Groups Seed</h2>
                <p className="text-xs text-gray-500 mt-1">Ensures the 21 system groups exist (5 Regional, 6 Cultural, 5 Professional, 5 Interest). Idempotent.</p>
              </div>
              <ActionBtn onClick={() => seedGroupsMut.mutate()} disabled={seedGroupsMut.isPending}>
                {seedGroupsMut.isPending ? 'Seeding…' : 'Seed Groups'}
              </ActionBtn>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Log tab ── */}
      {tab === 'activity' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Social Loop History <span className="text-gray-400 font-normal">(last 20 runs)</span>
            </h2>
            {!status?.socialLoopHistory || status.socialLoopHistory.length === 0
              ? <p className="text-sm text-gray-400 italic">No social loop runs recorded this session. Trigger a run to see detailed activity data here.</p>
              : (
                <div className="space-y-3">
                  {status.socialLoopHistory.map((snap, i) => (
                    <SocialLoopCard key={`${snap.ranAt}-${i}`} snap={snap} />
                  ))}
                </div>
              )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Drip History <span className="text-gray-400 font-normal">(last 20 runs)</span>
            </h2>
            {!status?.dripHistory || status.dripHistory.length === 0
              ? <p className="text-sm text-gray-400 italic">No drip runs recorded this session.</p>
              : (
                <div className="space-y-3">
                  {status.dripHistory.map((snap, i) => (
                    <DripCard key={`${snap.ranAt}-${i}`} snap={snap} />
                  ))}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 text-white text-sm px-4 py-3 rounded-lg shadow-lg z-50 ${toast.ok ? 'bg-green-700' : 'bg-red-700'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
