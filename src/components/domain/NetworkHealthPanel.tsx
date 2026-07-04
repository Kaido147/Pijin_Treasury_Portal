import type { NetworkService } from '@/core/types';
import { SERVICE_STATUS_CONFIG } from '@/core/constants';
import { cn } from '@/core/utils';

interface NetworkHealthPanelProps {
  services: NetworkService[];
}

export function NetworkHealthPanel({ services }: NetworkHealthPanelProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-card">
      <h3 className="text-navy-900 font-bold mb-5">Network Health</h3>
      <div className="space-y-3">
        {services.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No services reporting.
          </div>
        ) : (
          services.map((service) => {
            const cfg = SERVICE_STATUS_CONFIG[service.status];
            return (
              <div key={service.name} className="flex items-center gap-4">
                {/* Service name with dot */}
                <div className="flex items-center gap-2 w-28 lg:w-44 shrink-0">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      cfg.dotClass,
                    )}
                  />
                  <span className="text-navy-900 text-[0.85rem]">
                    {service.name}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex-1 h-1.5 rounded-full bg-surface-raised overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', cfg.barClass)}
                    style={{ width: `${service.uptime}%` }}
                  />
                </div>

                {/* Percentage */}
                <span className="text-slate-500 text-[0.72rem] font-mono w-[38px] text-right">
                  {service.uptime}%
                </span>

                {/* Status badge */}
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[0.7rem] font-bold whitespace-nowrap',
                    cfg.badgeBgClass,
                    cfg.badgeTextClass,
                  )}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
