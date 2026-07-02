import { Globe, Coins, Loader2, Trash2 } from 'lucide-react';
import type { GatewayNode } from '@/core/types';
import { NODE_STATUS_CONFIG } from '@/core/constants';
import { cn } from '@/core/utils';

interface GatewayNodeCardProps {
  node: GatewayNode;
  onFundClick: (address: string) => void;
  isRevoked?: boolean;
  onRevokeClick?: (address: string) => void;
  isRevoking?: boolean;
}

export function GatewayNodeCard({
  node,
  onFundClick,
  isRevoked = false,
  onRevokeClick,
  isRevoking = false,
}: GatewayNodeCardProps) {
  // For revoked cards, always show the 'inactive' config (slate/Revoked badge)
  const cfg = isRevoked
    ? NODE_STATUS_CONFIG['inactive']
    : NODE_STATUS_CONFIG[node.status] ?? NODE_STATUS_CONFIG['offline'];
  const StatusIcon = cfg.icon;

  return (
    <div
      className={cn(
        'bg-white rounded-2xl px-4 py-4 lg:px-6 lg:py-5 flex flex-wrap items-center gap-x-4 gap-y-3 shadow-card transition-opacity',
        isRevoked && 'opacity-60',
      )}
    >
      {/* Status icon */}
      <div
        className={cn(
          'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
          isRevoked ? 'bg-slate-200' : cfg.bgClass,
        )}
      >
        <StatusIcon
          className={cn(
            'w-5 h-5',
            isRevoked ? 'text-slate-400' : cfg.textClass,
            !isRevoked && node.status === 'syncing' && 'animate-spin',
          )}
        />
      </div>

      {/* Name + address */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-navy-900 font-bold text-[0.9rem]">
            {node.name}
          </span>
          {/* Status badge: revoked → slate REVOKED, else dynamic */}
          {isRevoked ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
              REVOKED
            </span>
          ) : (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold',
                cfg.bgClass,
                cfg.textClass,
              )}
            >
              {cfg.label}
            </span>
          )}
        </div>
        <div className="font-mono text-[0.68rem] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
          {node.address}
        </div>
      </div>

      {/* Balance (active only) */}
      {!isRevoked && (
        <div className="text-right shrink-0 hidden lg:block">
          <div className="text-slate-500 text-[0.7rem]">Balance</div>
          <div className="font-mono font-semibold text-sm text-navy-900">
            {node.balance} XLM
          </div>
        </div>
      )}

      {/* Region */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 bg-surface">
        <Globe className="w-3 h-3 text-slate-500" />
        <span className="text-slate-500 text-[0.72rem] font-mono">
          {node.region}
        </span>
      </div>

      {/* Action buttons — mutually exclusive based on isRevoked */}
      {isRevoked ? null : (
        <>
          {/* Fund Button */}
          <button
            id={`fund-node-btn-${node.id}`}
            type="button"
            onClick={() => onFundClick(node.address)}
            className="flex items-center gap-1.5 px-4 py-2.5 lg:px-3 lg:py-1.5 rounded-xl shrink-0 bg-navy-900 text-white text-[0.72rem] font-semibold transition-all hover:bg-navy-700"
          >
            <Coins className="w-3 h-3" />
            Fund
          </button>

          {/* Revoke button */}
          {onRevokeClick && (
            <button
              id={`revoke-node-btn-${node.id}`}
              type="button"
              onClick={() => onRevokeClick(node.address)}
              disabled={isRevoking}
              className="flex items-center gap-1 text-[0.72rem] font-semibold text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRevoking ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Revoke
            </button>
          )}
        </>
      )}
    </div>
  );
}
