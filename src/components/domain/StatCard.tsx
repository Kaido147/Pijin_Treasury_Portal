import type { ElementType } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/core/utils';

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  positive: boolean | null;
  icon: ElementType;
}

export function StatCard({
  label,
  value,
  delta,
  positive,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card">
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface">
          <Icon className="w-4 h-4 text-navy-900" />
        </div>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full',
            positive === null
              ? 'bg-slate-100'
              : positive
                ? 'bg-green-100'
                : 'bg-red-100',
          )}
        >
          {positive !== null && (
            delta.trim().startsWith('-')
              ? <ArrowDownRight className={cn('w-3 h-3', positive ? 'text-green-600' : 'text-red-600')} />
              : <ArrowUpRight className={cn('w-3 h-3', positive ? 'text-green-600' : 'text-red-600')} />
          )}
          <span
            className={cn(
              'text-[0.7rem] font-bold',
              positive === null
                ? 'text-slate-500'
                : positive
                  ? 'text-green-600'
                  : 'text-red-600',
            )}
          >
            {delta}
          </span>
        </div>
      </div>
      <div className="font-mono font-semibold text-[1.4rem] text-navy-900 mb-1">
        {value}
      </div>
      <div className="text-slate-500 text-[0.8rem]">{label}</div>
    </div>
  );
}
