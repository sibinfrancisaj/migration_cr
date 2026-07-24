import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { CohortBucket } from '@/types';

interface Props { data: CohortBucket[] }

export function CohortChart({ data }: Props) {
  const formatted = data.map((b) => ({
    week: b.cohortDate.slice(5),
    Registered:   b.registered,
    'D1 Retained': b.d1Retained,
    'D7 Retained': b.d7Retained,
    'D30 Retained': b.d30Retained,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f0e8" />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#78716c' }} />
        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e0d5', background: '#fff' }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Registered"    fill="#d97706" radius={[3, 3, 0, 0]} />
        <Bar dataKey="D1 Retained"   fill="#b45309" radius={[3, 3, 0, 0]} />
        <Bar dataKey="D7 Retained"   fill="#92400e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="D30 Retained"  fill="#4A3728" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
