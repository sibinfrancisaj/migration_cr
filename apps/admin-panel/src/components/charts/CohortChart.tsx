import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { CohortBucket } from '@/types';

interface Props { data: CohortBucket[] }

export function CohortChart({ data }: Props) {
  const formatted = data.map((b) => ({
    week: b.cohortDate.slice(5),   // MM-DD
    Registered: b.registered,
    'D1 Retained': b.d1Retained,
    'D7 Retained': b.d7Retained,
    'D30 Retained': b.d30Retained,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Registered" fill="#c026d3" radius={[3, 3, 0, 0]} />
        <Bar dataKey="D1 Retained" fill="#818cf8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="D7 Retained" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="D30 Retained" fill="#fb923c" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
