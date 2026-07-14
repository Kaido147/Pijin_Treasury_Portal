// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Domain Type System
// All data models used across the application.
// ═══════════════════════════════════════════════════════════

import type { ElementType } from 'react';

// ─── Wallet ─────────────────────────────────────────────

export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  balance: number;
  network: 'testnet' | 'mainnet';
  connect: () => void;
  disconnect: () => Promise<void>;
  logout: () => Promise<void>;
  signTransaction: (xdr: string, opts?: { networkPassphrase?: string; address?: string }) => Promise<string>;
}

/** Wallet summary data displayed on the Command Center hero card */
export interface WalletInfo {
  address: string;
  balancePhp: string;
  balanceXlm: string;
  change24h: string;
  fundedNodes: string;
  totalDistributed: string;
}

// ─── Gateway ────────────────────────────────────────────

export type RegionCode = string;

/** A region row from the `regions` Supabase table */
export interface Region {
  id: string;
  slug: string;
  name: string;
}

export type NodeStatus = 'active' | 'syncing' | 'offline' | 'inactive';

export interface GatewayNode {
  id: string;
  name: string;
  address: string;
  /** Human-readable region name resolved by API JOIN (e.g. "South East Asia 01") */
  region: string;
  /** Slug key stored in DB (e.g. "SEA-01") — use for filtering, URL params, dropdown re-selection */
  regionSlug: string;
  status: NodeStatus;
  uptime: string;
  balance: string;
}

// ─── Transactions ───────────────────────────────────────

export type TxStatus = 'confirmed' | 'pending' | 'failed';
export type TxType = 'debit' | 'credit';

export interface Transaction {
  id: string;
  hash: string;
  type: TxType;
  amount: string;
  from: string;
  to: string;
  memo: string;
  status: TxStatus;
  ts: Date;
}

// ─── System Metrics ─────────────────────────────────────

export interface StatMetric {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  /** Lucide icon identifier — mapped to a component via STAT_ICON_MAP */
  iconName: string;
}

export type ServiceStatus = 'operational' | 'degraded' | 'down';

export interface NetworkService {
  name: string;
  status: ServiceStatus;
  uptime: number;
}

// ─── Fund Node / Transfer ───────────────────────────────

export type TransferFormState = 'idle' | 'submitting' | 'success' | 'error';

// ─── Navigation ─────────────────────────────────────────

export interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
  exact: boolean;
}

// ─── Status Display Config ──────────────────────────────

export interface StatusConfig {
  label: string;
  /** Tailwind text color class (e.g. 'text-green-600') */
  textClass: string;
  /** Tailwind background class (e.g. 'bg-green-100') */
  bgClass: string;
  icon: ElementType;
}

export interface ServiceStatusConfig {
  label: string;
  dotClass: string;
  barClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
}
