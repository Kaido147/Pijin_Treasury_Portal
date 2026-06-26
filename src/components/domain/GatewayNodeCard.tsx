import { Globe, Coins } from 'lucide-react';
import type { GatewayNode } from '@/core/types';
import { NODE_STATUS_CONFIG } from '@/core/constants';
import { cn } from '@/core/utils';

interface GatewayNodeCardProps {
  node: GatewayNode;
  onFundClick: (address: string) => void;
}

export function GatewayNodeCard({ node, onFundClick }: GatewayNodeCardProps) {
  const cfg = NODE_STATUS_CONFIG[node.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="bg-white rounded-2xl px-6 py-5 flex items-center gap-5 shadow-card">
      {/* Status icon */}
      <div
        className={cn(
          'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
          cfg.bgClass,
        )}
      >
        <StatusIcon
          className={cn(
            'w-5 h-5',
            cfg.textClass,
            node.status === 'syncing' && 'animate-spin',
          )}
        />
      </div>

      {/* Name + address */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-navy-900 font-bold text-[0.9rem]">
            {node.name}
          </span>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-bold',
              cfg.bgClass,
              cfg.textClass,
            )}
          >
            {cfg.label}
          </span>
        </div>
        <div className="font-mono text-[0.68rem] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
          {node.address}
        </div>
      </div>

      {/* Balance */}
      <div className="text-right shrink-0 hidden md:block">
        <div className="text-slate-500 text-[0.7rem]">Balance</div>
        <div className="font-mono font-semibold text-sm text-navy-900">
          {node.balance} XLM
        </div>
      </div>

      {/* Uptime */}
      <div className="text-right shrink-0 hidden md:block">
        <div className="text-slate-500 text-[0.7rem]">Uptime</div>
        <div className="font-mono font-semibold text-sm text-navy-900">
          {node.uptime}
        </div>
      </div>

      {/* Region */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 bg-surface">
        <Globe className="w-3 h-3 text-slate-500" />
        <span className="text-slate-500 text-[0.72rem] font-mono">
          {node.region}
        </span>
      </div>

      {/* Fund Button */}
      <button
        id={`fund-node-btn-${node.id}`}
        type="button"
        onClick={() => onFundClick(node.address)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 bg-navy-900 text-white text-[0.72rem] font-semibold transition-all hover:bg-navy-700"
      >
        <Coins className="w-3 h-3" />
        Fund
      </button>



    </div >
  );
}
