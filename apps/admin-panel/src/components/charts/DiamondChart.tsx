import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { DiamondAnalyticsDto } from '@/types';

interface Props { data: DiamondAnalyticsDto }

const COLORS = ['#c026d3', '#818cf8', '#34d399', '#fb923c', '#f472b6', '#60a5fa'];

export function DiamondChart({ data }: Props) {
  const pieData = data.topSpendReasons.map((r) => ({
    name: r.reason.replace(/_/g, ' '),
    value: Math.abs(r.total),
  }));

  if (pieData.length === 0) {
    return <p className="text-xs text-gray-400 py-8 text-center">No spend data yet</p>;
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
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(v: number) => [v.toLocaleString(), 'diamonds']}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
