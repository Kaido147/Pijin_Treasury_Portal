import { ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import type { Transaction } from '@/core/types';
import { TX_STATUS_CONFIG } from '@/core/constants';
import { truncateAddress, formatTime, formatDate } from '@/core/utils';
import { cn } from '@/core/utils';

interface TransactionRowProps {
  transaction: Transaction;
  /** Whether this is the newest row (highlight effect when live) */
  isNew?: boolean;
}

export function TransactionRow({ transaction: tx, isNew }: TransactionRowProps) {
  const cfg = TX_STATUS_CONFIG[tx.status];
  const StatusIcon = cfg.icon;

  return (
    <>
      {/* ── Mobile card layout (< 1024px) ────────────────────────────────────────── */}
      <div
        className={cn(
          'flex lg:hidden flex-col gap-2 px-4 py-4 border-b border-surface transition-colors',
          isNew && 'bg-blue-50',
        )}
      >
        {/* Row 1: direction icon + hash + status badge */}
        <div className="flex items-center gap-2.5">
          {/* Direction icon */}
          <div
            className={cn(
              'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
              tx.type === 'debit' ? 'bg-red-100' : 'bg-green-100',
            )}
          >
            {tx.type === 'debit' ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 text-green-600" />
            )}
          </div>

          {/* Hash link */}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 inline-flex items-center gap-1 font-mono text-[0.72rem] text-navy-900 font-medium hover:text-blue-600 transition-colors group truncate"
          >
            <span className="truncate">{truncateAddress(tx.hash)}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </a>

          {/* Status badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-xl shrink-0',
              cfg.bgClass,
            )}
          >
            <StatusIcon
              className={cn(
                'w-3 h-3',
                cfg.textClass,
                tx.status === 'pending' && 'animate-pulse',
              )}
            />
            <span className={cn('text-[0.7rem] font-bold', cfg.textClass)}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Row 2: memo + datetime */}
        <div className="text-slate-400 text-[0.7rem] pl-9">
          {tx.memo} · {formatDate(tx.ts)} {formatTime(tx.ts)}
        </div>

        {/* Row 3: From / To addresses */}
        <div className="flex flex-col gap-0.5 pl-9">
          <div className="font-mono text-[0.68rem] text-slate-500 truncate">
            <span className="text-slate-400 mr-1">From</span>
            {truncateAddress(tx.from)}
          </div>
          <div className="font-mono text-[0.68rem] text-slate-500 truncate">
            <span className="text-slate-400 mr-1">To</span>
            {truncateAddress(tx.to)}
          </div>
        </div>

        {/* Row 4: amount (right-aligned) */}
        <div
          className={cn(
            'font-mono text-[0.9rem] font-bold text-right',
            tx.type === 'debit' ? 'text-red-600' : 'text-green-600',
          )}
        >
          {tx.type === 'debit' ? '-' : '+'}
          {parseFloat(tx.amount).toLocaleString()} XLM
        </div>
      </div>

      {/* ── Desktop grid layout (≥ 1024px) ───────────────────────────────────────── */}
      <div
        className={cn(
          'hidden lg:grid items-center px-6 py-3.5 transition-colors hover:bg-slate-50',
          isNew && 'bg-blue-50',
        )}
        style={{
          gridTemplateColumns: '28px 1fr 80px 100px 100px 90px',
          gap: '12px',
        }}
      >
        {/* Direction icon */}
        <div
          className={cn(
            'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
            tx.type === 'debit' ? 'bg-red-100' : 'bg-green-100',
          )}
        >
          {tx.type === 'debit' ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-green-600" />
          )}
        </div>

        {/* Hash & memo */}
        <div className="min-w-0">
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[0.72rem] text-navy-900 font-medium hover:text-blue-600 transition-colors group"
          >
            {truncateAddress(tx.hash)}
            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </a>
          <div className="text-slate-400 text-[0.7rem] mt-px">
            {tx.memo} · {formatDate(tx.ts)} {formatTime(tx.ts)}
          </div>
        </div>

        {/* Amount */}
        <div
          className={cn(
            'font-mono text-[0.82rem] font-semibold',
            tx.type === 'debit' ? 'text-red-600' : 'text-green-600',
          )}
        >
          {tx.type === 'debit' ? '-' : '+'}
          {parseFloat(tx.amount).toLocaleString()}
        </div>

        {/* From */}
        <div className="font-mono text-[0.68rem] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
          {truncateAddress(tx.from)}
        </div>

        {/* To */}
        <div className="font-mono text-[0.68rem] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
          {truncateAddress(tx.to)}
        </div>

        {/* Status */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-xl w-fit',
            cfg.bgClass,
          )}
        >
          <StatusIcon
            className={cn(
              'w-3 h-3',
              cfg.textClass,
              tx.status === 'pending' && 'animate-pulse',
            )}
          />
          <span className={cn('text-[0.7rem] font-bold', cfg.textClass)}>
            {cfg.label}
          </span>
        </div>
      </div>
    </>
  );
}
