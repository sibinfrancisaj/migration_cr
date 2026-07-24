import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { fetchMatchHealth, fetchUserMatches, fetchUserActivity } from '@/api/analytics';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import type { UserMatchDto } from '@/types';

export function MatchIntelligencePage() {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [inputUserId, setInputUserId]       = useState('');

  const healthQ = useQuery({
    queryKey: ['match-health'],
    queryFn: fetchMatchHealth,
    staleTime: 120_000,
  });

  const matchesQ = useQuery({
    queryKey: ['user-matches', selectedUserId],
    queryFn: () => fetchUserMatches(selectedUserId),
    enabled: !!selectedUserId,
    staleTime: 60_000,
  });

  const activityQ = useQuery({
    queryKey: ['user-activity', selectedUserId],
    queryFn: () => fetchUserActivity(selectedUserId),
    enabled: !!selectedUserId,
    staleTime: 60_000,
  });

  const health = healthQ.data;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSelectedUserId(inputUserId.trim());
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Match Intelligence</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Algorithm health · per-user match scores · daily activity
        </p>
      </div>

      {/* ── Algorithm Health KPIs ─────────────────────────────────────────── */}
      {healthQ.isError && <ErrorBanner message="Failed to load match health data" />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pairs Computed"
          value={healthQ.isLoading ? '—' : (health?.totalPairsComputed ?? 0).toLocaleString()}
          icon={<PairsIcon />}
          color="gold"
        />
        <StatCard
          label="Avg Score"
          value={healthQ.isLoading ? '—' : pct(health?.avgScore ?? 0)}
          sub={`median ${pct(health?.medianScore ?? 0)}`}
          icon={<ScoreIcon />}
          color="brown"
        />
        <StatCard
          label="Zero-Match Users"
          value={healthQ.isLoading ? '—' : (health?.usersWithZeroMatches ?? 0).toLocaleString()}
          sub="profiles with no pairs"
          icon={<AlertIcon />}
          color={health && health.usersWithZeroMatches > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Low-Score Users"
          value={healthQ.isLoading ? '—' : (health?.usersWithLowTopScore ?? 0).toLocaleString()}
          sub="best match < 30%"
          icon={<WarnIcon />}
          color={health && health.usersWithLowTopScore > 10 ? 'orange' : 'green'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Stale Pairs"
          value={healthQ.isLoading ? '—' : (health?.stalePairsCount ?? 0).toLocaleString()}
          sub="not recomputed in 7d"
          icon={<ClockIcon />}
          color={health && health.stalePairsCount > 100 ? 'orange' : 'teal'}
        />
        <StatCard
          label="Last Computed"
          value={health?.lastComputedAt
            ? new Date(health.lastComputedAt).toLocaleDateString()
            : healthQ.isLoading ? '—' : 'Never'}
          sub={health?.lastComputedAt ? new Date(health.lastComputedAt).toLocaleTimeString() : undefined}
          icon={<CalIcon />}
          color="gold"
        />
        {health?.algorithmVersions.map((v) => (
          <StatCard
            key={v.version}
            label={`Algorithm v${v.version}`}
            value={v.count.toLocaleString()}
            sub="pairs on this version"
            icon={<AlgIcon />}
            color="brown"
          />
        ))}
      </div>

      {/* ── Score Distribution Chart ──────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader
          title="Score Distribution"
          subtitle="Count of match pairs by score bucket (0–100)"
        />
        {healthQ.isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={health?.scoreDistribution ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f0e8" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#78716c' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e0d5' }}
              />
              <Bar dataKey="count" fill="#d97706" radius={[3, 3, 0, 0]} name="Pairs" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Per-User Lookup ───────────────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader title="Per-User Lookup" subtitle="Enter a User ID to inspect match scores and activity" />

        <form onSubmit={handleSearch} className="flex gap-2 mt-3">
          <input
            type="text"
            className="input flex-1"
            placeholder="User UUID…"
            value={inputUserId}
            onChange={(e) => setInputUserId(e.target.value)}
          />
          <button type="submit" className="btn-primary px-5">Search</button>
        </form>
      </div>

      {/* ── User Match Scores ─────────────────────────────────────────────── */}
      {selectedUserId && (
        <>
          {matchesQ.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : matchesQ.isError ? (
            <ErrorBanner message="Failed to load user matches" />
          ) : matchesQ.data ? (
            <div className="card p-5">
              <SectionHeader
                title={`Top Matches — ${matchesQ.data.user.name ?? matchesQ.data.user.phone}`}
                subtitle={`User ID: ${selectedUserId} · ${matchesQ.data.matches.length} pairs`}
              />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 px-3 text-xs font-medium text-stone-500">Matched User</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-stone-500">Score</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-stone-500">Alg v</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-stone-500 hidden lg:table-cell">Top Dimensions</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-stone-500">Computed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchesQ.data.matches.map((m: UserMatchDto) => (
                      <tr key={m.matchedUserId} className="border-b border-stone-50 hover:bg-amber-50/30">
                        <td className="py-2 px-3">
                          <p className="font-medium text-stone-900">{m.matchedUserName ?? '—'}</p>
                          <p className="text-xs text-stone-400">{m.matchedUserPhone}</p>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <ScorePill score={m.totalScore} />
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-stone-500">v{m.algorithmV}</td>
                        <td className="py-2 px-3 hidden lg:table-cell">
                          <TopDims breakdown={m.breakdown} />
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-stone-400">
                          {new Date(m.computedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {matchesQ.data.matches.length === 0 && (
                  <p className="text-sm text-stone-400 text-center py-6">No match pairs found for this user.</p>
                )}
              </div>
            </div>
          ) : null}

          {/* ── User Activity ─────────────────────────────────────────────── */}
          {activityQ.isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : activityQ.isError ? (
            <ErrorBanner message="Failed to load user activity" />
          ) : activityQ.data ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Summary cards */}
              <div className="card p-5">
                <SectionHeader title="Activity Summary" subtitle="7-day vs 30-day" />
                <div className="mt-3 space-y-3">
                  <SummaryRow
                    label="Profile Views"
                    week={activityQ.data.weeklySummary.profileViews}
                    month={activityQ.data.monthlySummary.profileViews}
                  />
                  <SummaryRow
                    label="Connections Sent"
                    week={activityQ.data.weeklySummary.connectionsSent}
                    month={activityQ.data.monthlySummary.connectionsSent}
                  />
                  <SummaryRow
                    label="Habits Logged"
                    week={activityQ.data.weeklySummary.habitsLogged}
                    month={activityQ.data.monthlySummary.habitsLogged}
                  />
                  <div className="pt-2 border-t border-stone-100">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-stone-500">Habit Streak</span>
                      <span className="text-sm font-bold" style={{ color: '#d97706' }}>
                        {activityQ.data.streakDays}d 🔥
                      </span>
                    </div>
                    {activityQ.data.lastActiveAt && (
                      <p className="text-xs text-stone-400 mt-1">
                        Last active: {new Date(activityQ.data.lastActiveAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Daily chart */}
              <div className="card p-5 lg:col-span-2">
                <SectionHeader title="Daily Activity (30d)" subtitle="Profile views and habits logged per day" />
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={activityQ.data.daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f0e8" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#78716c' }}
                      tickFormatter={(d: string) => d.slice(5)}
                      interval={4}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#78716c' }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e0d5' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="profileViews"   name="Profile Views"   stroke="#d97706" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="connectionsSent" name="Connections"     stroke="#92400e" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="habitsLogged"   name="Habits"          stroke="#b45309" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number) { return (n * 100).toFixed(1) + '%'; }

function ScorePill({ score }: { score: number }) {
  const pctVal = Math.round(score * 100);
  const color = pctVal >= 70 ? '#16a34a' : pctVal >= 40 ? '#d97706' : '#dc2626';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: color + '20', color }}>
      {pctVal}%
    </span>
  );
}

function TopDims({ breakdown }: { breakdown: Record<string, number> }) {
  const top = Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  return (
    <div className="flex flex-wrap gap-1">
      {top.map(([k, v]) => (
        <span key={k} className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">
          {k}: {(v * 100).toFixed(0)}%
        </span>
      ))}
    </div>
  );
}

function SummaryRow({ label, week, month }: { label: string; week: number; month: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-stone-500">{label}</span>
      <div className="flex gap-3">
        <span className="text-xs text-stone-400">7d: <strong className="text-stone-700">{week}</strong></span>
        <span className="text-xs text-stone-400">30d: <strong className="text-stone-700">{month}</strong></span>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const ic = (d: string) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const PairsIcon  = () => ic('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0');
const ScoreIcon  = () => ic('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z');
const AlertIcon  = () => ic('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z');
const WarnIcon   = () => ic('M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
const ClockIcon  = () => ic('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z');
const CalIcon    = () => ic('M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z');
const AlgIcon    = () => ic('M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z');
