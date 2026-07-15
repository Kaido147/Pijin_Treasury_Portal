import { AlertTriangle, Wallet } from 'lucide-react';
import type {
  NetworkService,
  RelayerReadiness,
  RelayerReadinessStatus,
} from '@/core/types';
import { SERVICE_STATUS_CONFIG } from '@/core/constants';
import { cn, truncateAddress } from '@/core/utils';

interface NetworkHealthPanelProps {
  services: NetworkService[];
  relayers: RelayerReadiness[];
  warnings?: string[];
}

const READINESS_CONFIG: Record<
  RelayerReadinessStatus,
  { label: string; badge: string; dot: string }
> = {
  ready: {
    label: 'Ready',
    badge: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
  },
  low_balance: {
    label: 'Low Balance',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  unfunded: {
    label: 'Unfunded',
    badge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
  unauthorized: {
    label: 'Unauthorized',
    badge: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
  },
  unavailable: {
    label: 'Check Failed',
    badge: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
  },
};

export function NetworkHealthPanel({
  services,
  relayers,
  warnings = [],
}: NetworkHealthPanelProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-6 shadow-card">
        <h3 className="text-navy-900 font-bold mb-1">Stellar Network Health</h3>
        <p className="text-slate-400 text-xs mb-5">
          Live response time from the services used to process and confirm transactions.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {services.map((service) => {
            const cfg = SERVICE_STATUS_CONFIG[service.status];
            return (
              <div
                key={service.name}
                className="rounded-xl border border-border-default px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dotClass)} />
                    <span className="text-navy-900 text-sm font-semibold truncate">
                      {service.name}
                    </span>
                  </div>
                  <span className="font-mono text-sm text-navy-900">
                    {service.latencyMs === null ? '—' : `${service.latencyMs}ms`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2">
                  <span className="text-slate-400 text-xs truncate">{service.detail}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[0.68rem] font-bold whitespace-nowrap',
                      cfg.badgeBgClass,
                      cfg.badgeTextClass,
                    )}
                  >
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 text-navy-900" />
          <h3 className="text-navy-900 font-bold">Trusted Relayer Wallet Readiness</h3>
        </div>
        <p className="text-slate-400 text-xs mb-5">
          On-chain authorization and spendable XLM are checked live. Wallet uptime is not inferred.
        </p>

        <div className="space-y-3">
          {relayers.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              No trusted relayer wallets are registered.
            </div>
          ) : (
            relayers.map((relayer) => {
              const cfg = READINESS_CONFIG[relayer.status];
              return (
                <div
                  key={relayer.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border-default px-4 py-3"
                  title={relayer.detail}
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-navy-900 text-sm font-semibold">{relayer.name}</div>
                    <div className="font-mono text-[0.68rem] text-slate-400">
                      {truncateAddress(relayer.address, 10, 6)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-navy-900">
                      {relayer.availableXlm} XLM available
                    </div>
                    <div className="text-[0.68rem] text-slate-400">
                      {relayer.balanceXlm} XLM total
                    </div>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-full text-[0.68rem] font-bold', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-xs">
          {warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
