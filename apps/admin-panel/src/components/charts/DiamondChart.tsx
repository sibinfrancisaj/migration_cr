import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { DiamondAnalyticsDto } from '@/types';

interface Props { data: DiamondAnalyticsDto }

// Gold → Brown palette for pie segments
const COLORS = ['#d97706', '#b45309', '#92400e', '#78350f', '#f59e0b', '#6B4F12'];

export function DiamondChart({ data }: Props) {
  const pieData = data.topSpendReasons.map((r) => ({
    name: r.reason.replace(/_/g, ' '),
    value: Math.abs(r.total),
  }));

  if (pieData.length === 0) {
    return <p className="text-xs text-stone-400 py-8 text-center">No spend data yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={72}
          paddingAngle={2}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7e0d5' }}
          formatter={(v: number) => [v.toLocaleString(), 'diamonds']}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
