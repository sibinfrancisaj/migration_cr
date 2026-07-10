import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: { value: string; up: boolean };
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal';
}

const colorMap = {
  blue:   'bg-blue-50 text-blue-600',
  green:  'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  red:    'bg-red-50 text-red-600',
  teal:   'bg-teal-50 text-teal-600',
};

export function StatCard({ label, value, sub, icon, trend, color = 'blue' }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 truncate">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-500 truncate">{sub}</p>}
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.up ? 'text-green-600' : 'text-red-600'}`}>
              {trend.up ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={`flex-shrink-0 ml-3 p-2.5 rounded-lg ${colorMap[color]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
