import { cn } from '@/core/utils';

interface SkeletonCardProps {
  /** Number of text-line skeletons to render (default 3) */
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-5 shadow-card animate-pulse',
        className,
      )}
    >
      {/* Icon placeholder */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl bg-surface-raised" />
        <div className="w-14 h-5 rounded-full bg-surface-raised" />
      </div>

      {/* Content lines */}
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-md bg-surface-raised"
            style={{ width: `${80 - i * 15}%` }}
          />
        ))}
      </div>
    </div>
  );
}
