// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Application Constants
// Static configuration data imported by hooks and components.
// ═══════════════════════════════════════════════════════════

import {
  LayoutDashboard,
  Server,
  FileText,
  Wifi,
  Loader2,
  WifiOff,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
  TrendingUp,
  Zap,
  ArrowRightLeft,
  Wallet,
  LogOut,
  UserPlus,
  UserCog,
} from 'lucide-react';
import type { ElementType } from 'react';
import type {
  NavItem,
  NodeStatus,
  TxStatus,
  StatusConfig,
  ServiceStatus,
  ServiceStatusConfig,
  ActivityType,
} from '@/core/types';

// ─── Navigation ─────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  { href: '/command-center', label: 'Command Center', icon: LayoutDashboard, exact: true },
  { href: '/gateway-ops', label: 'Gateway Ops', icon: Server, exact: false },
  { href: '/ledger', label: 'Transaction Ledger', icon: FileText, exact: false },

];

// ─── Gateway Node Status ────────────────────────────────

export const NODE_STATUS_CONFIG: Record<NodeStatus, StatusConfig> = {
  active: { label: 'Active', textClass: 'text-green-600', bgClass: 'bg-green-100', icon: Wifi },
  syncing: { label: 'Syncing', textClass: 'text-amber-600', bgClass: 'bg-amber-100', icon: Loader2 },
  offline: { label: 'Offline', textClass: 'text-red-600', bgClass: 'bg-red-100', icon: WifiOff },
  inactive: { label: 'Revoked', textClass: 'text-slate-500', bgClass: 'bg-slate-200', icon: WifiOff },
};

// ─── Transaction Status ─────────────────────────────────

export const TX_STATUS_CONFIG: Record<TxStatus, StatusConfig> = {
  confirmed: { icon: CheckCircle2, textClass: 'text-green-600', bgClass: 'bg-green-100', label: 'Confirmed' },
  pending: { icon: Clock, textClass: 'text-amber-600', bgClass: 'bg-amber-100', label: 'Pending' },
  failed: { icon: XCircle, textClass: 'text-red-600', bgClass: 'bg-red-100', label: 'Failed' },
};

// ─── Network Service Status ─────────────────────────────

export const SERVICE_STATUS_CONFIG: Record<ServiceStatus, ServiceStatusConfig> = {
  operational: {
    label: 'Operational',
    dotClass: 'bg-green-400',
    barClass: 'bg-green-400',
    badgeBgClass: 'bg-green-100',
    badgeTextClass: 'text-green-600',
  },
  degraded: {
    label: 'Degraded',
    dotClass: 'bg-orange-400',
    barClass: 'bg-orange-400',
    badgeBgClass: 'bg-orange-50',
    badgeTextClass: 'text-orange-700',
  },
  down: {
    label: 'Down',
    dotClass: 'bg-red-500',
    barClass: 'bg-red-500',
    badgeBgClass: 'bg-red-100',
    badgeTextClass: 'text-red-600',
  },
};

// ─── Stat Metric Icon Map ───────────────────────────────
// Maps string identifiers (used in StatMetric.iconName) to Lucide components.

export const STAT_ICON_MAP: Record<string, ElementType> = {
  server: Server,
  zap: Zap,
  activity: Activity,
  'trending-up': TrendingUp,
};


// ─── Stellar Network ───────────────────────────────────

export const STELLAR_ADDRESSES = [
  'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZUOZ7DOE5KQPBSM3YAFM',
  'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBLAOPV7P5PL',
  'GBRMB7MFPND5JLXDTUKJBWWKUVCLMKNM3MJ2QGJCYZLBM6OBG6HRWKN',
  'GDQJUTQYK2MQX2DGUUVEXC3ZRWLN4VNTXF7SSZXATRKM6HGS5COFBKR',
] as const;

export const ADMIN_ADDRESS =
  'GBRMB7MFPND5JLXDTUKJBWWKUVCLMKNM3MJ2QGJCYZLBM6OBG6HRWKN';

export const TRANSACTION_MEMOS = [
  'Node funding · SEA-01',
  'Node funding · SEA-02',
  'Liquidity top-up',
  'Emergency reserve',
  'Monthly allocation',
] as const;

// ─── Fund Node Page ─────────────────────────────────────

export const QUICK_FILL_ADDRESSES = [
  'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZUOZ7DOE5KQPBSM3YAFM',
  'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBLAOPV7P5PL',
] as const;

export const QUICK_AMOUNTS = ['100', '500', '1000', '5000'] as const;

// ─── Polling & Refresh Intervals ────────────────────────

/** Live ledger poll interval in milliseconds (RPC has no streaming — we poll) */
export const LEDGER_POLL_INTERVAL_MS = 5000;

/** Maximum transactions to keep in the legacy ledger view */
export const LEDGER_MAX_TRANSACTIONS = 40;

/** Initial number of transactions to generate on page load */
export const LEDGER_INITIAL_COUNT = 12;

/** Command Center auto-refresh interval in milliseconds */
export const DASHBOARD_REFRESH_INTERVAL_MS = 30000;

// ─── Contract Token / Currency Configuration ────────────
/** Configuration for the primary token used by the Soroban smart contract (PHP Fiat) */
export const CONTRACT_TOKEN_CONFIG = {
  SYMBOL: 'PHP',
  /** Soroban / Stellar token decimals (defaulting to 7 raw units per 1 PHP; can be changed to 2 if token uses 2 decimals) */
  DECIMALS: 7,
} as const;

// ─── Contract Event Ledger ───────────────────────────────

/** Poll interval for the contract event ledger (Stellar RPC has no SSE) */
export const CONTRACT_EVENT_POLL_MS = 10_000;

/** Number of events to fetch per page from /api/ledger/events */
export const CONTRACT_EVENT_LIMIT = 50;

/** Display config for each ActivityType in the contract event ledger */
export const ACTIVITY_TYPE_CONFIG: Record<
  ActivityType,
  { label: string; icon: ElementType; textClass: string; bgClass: string }
> = {
  spend: {
    label: 'Spend',
    icon: ArrowRightLeft,
    textClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-500/10 dark:bg-blue-500/15',
  },
  deposit: {
    label: 'Deposit',
    icon: Wallet,
    textClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/15',
  },
  withdraw: {
    label: 'Withdraw',
    icon: LogOut,
    textClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
  },
  register_recipient: {
    label: 'Register',
    icon: UserPlus,
    textClass: 'text-purple-600 dark:text-purple-400',
    bgClass: 'bg-purple-500/10 dark:bg-purple-500/15',
  },
  update_recipient: {
    label: 'Update',
    icon: UserCog,
    textClass: 'text-indigo-600 dark:text-indigo-400',
    bgClass: 'bg-indigo-500/10 dark:bg-indigo-500/15',
  },
};
