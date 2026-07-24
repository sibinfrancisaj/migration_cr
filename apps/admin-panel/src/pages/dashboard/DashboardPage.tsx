import { useQuery } from '@tanstack/react-query';
import {
  fetchKpi, fetchCohort, fetchGroupAnalytics,
  fetchDropAnalytics, fetchAiAnalytics, fetchDiamondAnalytics, fetchSeederStatus,
} from '@/api/analytics';
import { StatCard } from '@/components/ui/StatCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CohortChart } from '@/components/charts/CohortChart';
import { DiamondChart } from '@/components/charts/DiamondChart';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

function pct(n: number) { return (n * 100).toFixed(1) + '%'; }
function fmt(n: number)  { return n.toLocaleString(); }

export function DashboardPage() {
  const kpiQ    = useQuery({ queryKey: ['kpi'],    queryFn: () => fetchKpi(),            staleTime: 60_000 });
  const cohortQ = useQuery({ queryKey: ['cohort'], queryFn: () => fetchCohort(),         staleTime: 300_000 });
  const groupQ  = useQuery({ queryKey: ['groups-analytics'], queryFn: () => fetchGroupAnalytics(), staleTime: 120_000 });
  const dropQ   = useQuery({ queryKey: ['drops-analytics'],  queryFn: () => fetchDropAnalytics(),  staleTime: 120_000 });
  const aiQ     = useQuery({ queryKey: ['ai-analytics'],     queryFn: () => fetchAiAnalytics(),    staleTime: 120_000 });
  const diamondQ = useQuery({ queryKey: ['diamond-analytics'], queryFn: () => fetchDiamondAnalytics(), staleTime: 120_000 });
  const seederQ = useQuery({ queryKey: ['seeder-status'],    queryFn: () => fetchSeederStatus(),   staleTime: 30_000 });

  const kpi = kpiQ.data;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Platform health overview · Last 30 days
        </p>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      {kpiQ.isError && <ErrorBanner message="Failed to load KPI data" />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="New Registrations"
          value={kpiQ.isLoading ? '—' : fmt(kpi?.users.newRegistrations ?? 0)}
          icon={<UserIcon />}
          color="gold"
        />
        <StatCard
          label="Active Users"
          value={kpiQ.isLoading ? '—' : fmt(kpi?.users.totalActive ?? 0)}
          sub={`${kpi?.users.suspended ?? 0} suspended`}
          icon={<ActiveIcon />}
          color="green"
        />
        <StatCard
          label="Active Members"
          value={kpiQ.isLoading ? '—' : fmt(kpi?.membership.totalActive ?? 0)}
          sub={`${kpi?.membership.conversionRate ?? '—'} conversion`}
          icon={<MemberIcon />}
          color="brown"
        />
        <StatCard
          label="Avg Match Score"
          value={kpiQ.isLoading ? '—' : pct(kpi?.matching.avgTotalScore ?? 0)}
          sub="across all computed pairs"
          icon={<MatchIcon />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Connections Sent"
          value={kpiQ.isLoading ? '—' : fmt(kpi?.connections.requestsSent ?? 0)}
          sub={`${kpi?.connections.acceptanceRate ?? '—'} acceptance`}
          icon={<ConnIcon />}
          color="teal"
        />
        <StatCard
          label="Profiles Complete"
          value={kpiQ.isLoading ? '—' : fmt(kpi?.profiles.totalComplete ?? 0)}
          sub={`avg ${kpi?.profiles.avgCompletionScore ?? 0}% score`}
          icon={<ProfileIcon />}
          color="gold"
        />
        <StatCard
          label="Diamonds Spent"
          value={kpiQ.isLoading ? '—' : fmt(kpi?.diamonds.totalSpentPaise ?? 0)}
          sub={`${fmt(kpi?.diamonds.totalCreditedPaise ?? 0)} credited`}
          icon={<DiamondIcon />}
          color="brown"
        />
        <StatCard
          label="Voice Intros"
          value={kpiQ.isLoading ? '—' : fmt(kpi?.profiles.voiceIntroCount ?? 0)}
          sub="profiles with voice intro"
          icon={<VoiceIcon />}
          color="orange"
        />
      </div>

      {/* ── Middle Row — Cohort + Group Stats ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Cohort Retention */}
        <div className="card p-5 lg:col-span-2">
          <SectionHeader
            title="Weekly Cohort Registrations"
            subtitle="Signup volume by week · last 12 weeks"
          />
          {cohortQ.isLoading ? (
            <div className="flex items-center justify-center h-48"><Spinner /></div>
          ) : cohortQ.isError ? (
            <ErrorBanner message="Could not load cohort data" />
          ) : (
            <CohortChart data={cohortQ.data ?? []} />
          )}
        </div>

        {/* Group Stats */}
        <div className="card p-5">
          <SectionHeader title="Groups" subtitle="Community activity" />
          {groupQ.isLoading ? (
            <div className="flex items-center justify-center h-24"><Spinner /></div>
          ) : groupQ.isError ? (
            <ErrorBanner message="Could not load group data" />
          ) : (
            <div className="space-y-3 mt-2">
              <Row label="Total Groups"   value={fmt(groupQ.data?.totalGroups ?? 0)} />
              <Row label="Total Members"  value={fmt(groupQ.data?.totalMembers ?? 0)} />
              <Row label="Total Posts"    value={fmt(groupQ.data?.totalPosts ?? 0)} />
              <Row label="Active (7d)"    value={fmt(groupQ.data?.activeGroupsLast7Days ?? 0)} />
              {groupQ.data?.byType && Object.entries(groupQ.data.byType).map(([type, count]) => (
                <Row key={type} label={type} value={fmt(count as number)} indent />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row — Drops + AI + Diamond + Seeder ──────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">

        {/* Intro Drops */}
        <div className="card p-5">
          <SectionHeader title="Intro Drops" subtitle="Matchmaking funnel" />
          {dropQ.isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <div className="space-y-3 mt-2">
              <Row label="Total Drops"    value={fmt(dropQ.data?.totalDrops ?? 0)} />
              <Row label="Total Pairings" value={fmt(dropQ.data?.totalPairings ?? 0)} />
              <Row label="Early Access"   value={dropQ.data?.earlyAccessRate ?? '—'} />
              <Row label="Unlock Rate"    value={dropQ.data?.unlockRate ?? '—'} />
              {dropQ.data?.byStatus && Object.entries(dropQ.data.byStatus).map(([s, n]) => (
                <Row key={s} label={s} value={fmt(n as number)} indent />
              ))}
            </div>
          )}
        </div>

        {/* AI Embedding Health */}
        <div className="card p-5">
          <SectionHeader title="AI Coverage" subtitle="Profile embedding status" />
          {aiQ.isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <div className="space-y-3 mt-2">
              <Row label="Total Embeddings" value={fmt(aiQ.data?.totalEmbeddings ?? 0)} />
              <Row label="Coverage"         value={aiQ.data?.coverageRate ?? '—'} />
              <Row label="Stale"            value={fmt(aiQ.data?.staleCount ?? 0)} highlight={!!aiQ.data?.staleCount} />
              <Row label="Pending"          value={fmt(aiQ.data?.pendingCount ?? 0)} />
              {aiQ.data?.lastComputedAt && (
                <p className="text-xs text-gray-400 mt-2">
                  Last: {new Date(aiQ.data.lastComputedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Diamond Economy */}
        <div className="card p-5">
          <SectionHeader title="Diamond Economy" subtitle="Top spend reasons" />
          {diamondQ.isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <DiamondChart data={diamondQ.data ?? { totalIssued: 0, totalSpent: 0, netBalance: 0, topSpendReasons: [] }} />
          )}
        </div>

        {/* Seeder Status */}
        <div className="card p-5">
          <SectionHeader title="Seeder / Bots" subtitle="Synthetic data status" />
          {seederQ.isLoading ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <div className="space-y-3 mt-2">
              <StatusPill label="Drip" active={!seederQ.data?.dripPaused} />
              <StatusPill label="Running" active={!!seederQ.data?.isRunning} />
              <Row label="Bot Profiles"   value={fmt(seederQ.data?.seededProfileCount ?? 0)} />
              <Row label="Total Created"  value={fmt(seederQ.data?.totalProfilesCreated ?? 0)} />
              {seederQ.data?.lastDripAt && (
                <p className="text-xs text-gray-400 mt-2">
                  Last drip: {new Date(seederQ.data.lastDripAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function Row({ label, value, indent, highlight }: { label: string; value: string; indent?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${indent ? 'pl-3' : ''}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-stone-500">{label}</span>
      <span className={`badge ${active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
        {active ? 'Active' : 'Paused'}
      </span>
    </div>
  );
}

// ── Icons (inline SVG, no deps) ───────────────────────────────────────────────

const ic = (d: string) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const UserIcon    = () => ic('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z');
const ActiveIcon  = () => ic('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0');
const MemberIcon  = () => ic('M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z');
const MatchIcon   = () => ic('M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z');
const ConnIcon    = () => ic('M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z');
const ProfileIcon = () => ic('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2');
const DiamondIcon = () => ic('M12 6v6m0 0v6m0-6h6m-6 0H6');
const VoiceIcon   = () => ic('M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z');
