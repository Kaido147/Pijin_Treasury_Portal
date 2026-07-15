'use client';

import { ExternalLink, ChevronDown } from 'lucide-react';
import type {
  NetworkActivity,
  SpendActivity,
  DepositActivity,
  WithdrawActivity,
  RecipientActivity,
} from '@/core/types';
import { ACTIVITY_TYPE_CONFIG, CONTRACT_TOKEN_CONFIG } from '@/core/constants';
import { truncateAddress, formatTime, formatDate } from '@/core/utils';
import { cn } from '@/core/utils';

// ─── Formatting helpers ──────────────────────────────────

/** Convert raw contract token units (i128 as decimal string) to human-readable amount */
function formatContractAmount(raw: string): string {
  try {
    const value = BigInt(raw);
    const divisor = Math.pow(10, CONTRACT_TOKEN_CONFIG.DECIMALS);
    const amount  = Number(value) / divisor;
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: CONTRACT_TOKEN_CONFIG.DECIMALS,
    });
  } catch {
    return raw;
  }
}

/** Shorten a hex nonce to "0x1234…abcd" for display */
function shortenHex(hex: string): string {
  if (hex.length <= 12) return `0x${hex}`;
  return `0x${hex.slice(0, 4)}…${hex.slice(-4)}`;
}

// ─── Detail field helper ─────────────────────────────────

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground/75">
        {label}
      </span>
      <span
        className={cn(
          'text-[0.72rem] text-foreground/85 break-all',
          mono && 'font-mono',
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Activity-specific row summaries ─────────────────────

function SpendSummary({ a }: { a: SpendActivity }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 font-mono text-[0.72rem] text-foreground font-medium truncate">
        <span className="truncate">{truncateAddress(a.sender)}</span>
        <span className="text-muted-foreground/50">→</span>
        <span className="font-extrabold text-blue-600 dark:text-blue-400">{a.receiverShortId}</span>
      </div>
      <div className="text-muted-foreground/70 text-[0.68rem] truncate">
        {formatContractAmount(a.amount)} {CONTRACT_TOKEN_CONFIG.SYMBOL} · toll {formatContractAmount(a.protocolToll)} {CONTRACT_TOKEN_CONFIG.SYMBOL} · {formatDate(new Date(a.timestamp))} {formatTime(new Date(a.timestamp))}
      </div>
    </div>
  );
}

function SpendDetail({ a }: { a: SpendActivity }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
      <DetailField label="Sender"           value={a.sender}             mono />
      <DetailField label="Receiver Address" value={a.receiver}           mono />
      <DetailField label="Short ID"         value={a.receiverShortId}    mono />
      <DetailField label="Gateway"          value={a.gateway}            mono />
      <DetailField label="Token"            value={a.token}              mono />
      <DetailField label="Amount"           value={`${formatContractAmount(a.amount)} ${CONTRACT_TOKEN_CONFIG.SYMBOL}`} />
      <DetailField label="Protocol Toll"    value={`${formatContractAmount(a.protocolToll)} ${CONTRACT_TOKEN_CONFIG.SYMBOL}`} />
      <DetailField label="Remaining Balance" value={`${formatContractAmount(a.balance)} ${CONTRACT_TOKEN_CONFIG.SYMBOL}`} />
      <DetailField label="Nonce"            value={shortenHex(a.nonce)}  mono />
    </div>
  );
}

function DepositSummary({ a }: { a: DepositActivity }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="font-mono text-[0.72rem] text-foreground font-medium truncate">
        {truncateAddress(a.sender)} deposited {formatContractAmount(a.amount)} {CONTRACT_TOKEN_CONFIG.SYMBOL}
      </div>
      <div className="text-muted-foreground/70 text-[0.68rem]">
        {formatDate(new Date(a.timestamp))} {formatTime(new Date(a.timestamp))}
      </div>
    </div>
  );
}

function DepositDetail({ a }: { a: DepositActivity }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
      <DetailField label="Sender"      value={a.sender}                       mono />
      <DetailField label="Token"       value={a.token}                        mono />
      <DetailField label="Amount"      value={`${formatContractAmount(a.amount)} ${CONTRACT_TOKEN_CONFIG.SYMBOL}`} />
      <DetailField label="New Balance" value={`${formatContractAmount(a.balance)} ${CONTRACT_TOKEN_CONFIG.SYMBOL}`} />
    </div>
  );
}

function WithdrawSummary({ a }: { a: WithdrawActivity }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="font-mono text-[0.72rem] text-foreground font-medium truncate">
        {truncateAddress(a.sender)} withdrew {formatContractAmount(a.amount)} {CONTRACT_TOKEN_CONFIG.SYMBOL}
      </div>
      <div className="text-muted-foreground/70 text-[0.68rem]">
        {formatDate(new Date(a.timestamp))} {formatTime(new Date(a.timestamp))}
      </div>
    </div>
  );
}

function WithdrawDetail({ a }: { a: WithdrawActivity }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
      <DetailField label="Sender" value={a.sender}                       mono />
      <DetailField label="Token"  value={a.token}                        mono />
      <DetailField label="Amount" value={`${formatContractAmount(a.amount)} ${CONTRACT_TOKEN_CONFIG.SYMBOL}`} />
    </div>
  );
}

function RecipientSummary({ a }: { a: RecipientActivity }) {
  const verb = a.type === 'register_recipient' ? 'Registered' : 'Updated';
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="font-mono text-[0.72rem] text-foreground font-medium truncate">
        {verb}{' '}
        <span className="font-extrabold text-purple-600 dark:text-purple-400">{a.shortId}</span>
        {' → '}
        {truncateAddress(a.receiver)}
      </div>
      <div className="text-muted-foreground/70 text-[0.68rem]">
        {formatDate(new Date(a.timestamp))} {formatTime(new Date(a.timestamp))}
      </div>
    </div>
  );
}

function RecipientDetail({ a }: { a: RecipientActivity }) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-2">
      <DetailField label="Short ID"         value={a.shortId}  mono />
      <DetailField label="Receiver Address" value={a.receiver} mono />
    </div>
  );
}

// ─── Amount badge (right side of row) ────────────────────

function AmountBadge({ activity }: { activity: NetworkActivity }) {
  switch (activity.type) {
    case 'spend':
      return (
        <div className="font-mono text-[0.82rem] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
          {formatContractAmount(activity.amount)} <span className="text-[0.68rem] font-normal">{CONTRACT_TOKEN_CONFIG.SYMBOL}</span>
        </div>
      );
    case 'deposit':
      return (
        <div className="font-mono text-[0.82rem] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
          +{formatContractAmount(activity.amount)} <span className="text-[0.68rem] font-normal">{CONTRACT_TOKEN_CONFIG.SYMBOL}</span>
        </div>
      );
    case 'withdraw':
      return (
        <div className="font-mono text-[0.82rem] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
          -{formatContractAmount(activity.amount)} <span className="text-[0.68rem] font-normal">{CONTRACT_TOKEN_CONFIG.SYMBOL}</span>
        </div>
      );
    default:
      return null;
  }
}

// ─── Main component ──────────────────────────────────────

export interface ActivityRowProps {
  activity: NetworkActivity;
  isNew?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ActivityRow({
  activity: a,
  isNew,
  isExpanded,
  onToggle,
}: ActivityRowProps) {
  const cfg       = ACTIVITY_TYPE_CONFIG[a.type];
  const TypeIcon  = cfg.icon;
  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${a.txHash}`;

  return (
    <div
      className={cn(
        'px-4 lg:px-6 transition-colors border-b border-border/40 last:border-0',
        isNew && 'bg-blue-500/10 dark:bg-blue-500/15',
        !isNew && 'hover:bg-muted/40',
      )}
    >
      {/* ── Collapsed row ──────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
        className="flex items-center gap-3 py-3.5 cursor-pointer select-none"
      >
        {/* Activity type icon badge */}
        <div
          className={cn(
            'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
            cfg.bgClass,
          )}
        >
          <TypeIcon className={cn('w-3.5 h-3.5', cfg.textClass)} />
        </div>

        {/* Summary content */}
        <div className="flex-1 min-w-0">
          {a.type === 'spend'             && <SpendSummary     a={a} />}
          {a.type === 'deposit'           && <DepositSummary   a={a} />}
          {a.type === 'withdraw'          && <WithdrawSummary  a={a} />}
          {(a.type === 'register_recipient' || a.type === 'update_recipient') && (
            <RecipientSummary a={a} />
          )}
        </div>

        {/* Amount badge */}
        <AmountBadge activity={a} />

        {/* Type badge (desktop) */}
        <div
          className={cn(
            'hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-xl text-[0.68rem] font-bold shrink-0',
            cfg.bgClass,
            cfg.textClass,
          )}
        >
          {cfg.label}
        </div>

        {/* External link */}
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 opacity-40 hover:opacity-100 transition-opacity"
          aria-label="View on StellarExpert"
        >
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
        </a>

        {/* Expand chevron */}
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
        />
      </div>

      {/* ── Expanded detail panel ───────────────────────────── */}
      {isExpanded && (
        <div className="pb-4 pt-1 border-t border-surface/60">
          {/* Tx Hash */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground/75">
              Transaction
            </span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[0.7rem] text-foreground hover:text-primary transition-colors"
            >
              {truncateAddress(a.txHash)}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          {/* Type-specific detail grid */}
          {a.type === 'spend'             && <SpendDetail     a={a} />}
          {a.type === 'deposit'           && <DepositDetail   a={a} />}
          {a.type === 'withdraw'          && <WithdrawDetail  a={a} />}
          {(a.type === 'register_recipient' || a.type === 'update_recipient') && (
            <RecipientDetail a={a} />
          )}
        </div>
      )}
    </div>
  );
}
