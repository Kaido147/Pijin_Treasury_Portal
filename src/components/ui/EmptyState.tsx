import type { ElementType } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/core/utils';

interface EmptyStateProps {
  /** Lucide icon component (defaults to Inbox) */
  icon?: ElementType;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-surface-raised mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-navy-900 font-bold text-base mb-1">{title}</h3>
      {description && (
        <p className="text-slate-400 text-sm text-center max-w-xs">
          {description}
        </p>
      )}
    </div>
  );
}
