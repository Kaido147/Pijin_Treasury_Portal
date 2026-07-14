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

// ─── Transactions (legacy — wallet-centric view) ────────

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

// ─── Contract Events (contract-centric ledger) ──────────
//
// Mirrors the 5 event structs emitted by the deployed
// PijinContract (contracts/src/lib.rs):
//   deposit  → DepositEvent
//   spend    → SpendEvent
//   withdraw → WithdrawEvent
//   recipient / recipupd → RecipientEvent

export type ActivityType =
  | 'spend'
  | 'deposit'
  | 'withdraw'
  | 'register_recipient'
  | 'update_recipient';

/** Filter type used by useContractLedger */
export type ActivityFilter = ActivityType | 'all';

interface BaseActivity {
  /** Globally unique event ID from Stellar RPC (e.g. "0001234-0") */
  id: string;
  /** Parent transaction hash */
  txHash: string;
  /** Ledger sequence number — used as pagination cursor */
  ledger: number;
  /** Discriminated union tag */
  type: ActivityType;
  /** ISO 8601 ledger close time */
  timestamp: string;
}

/** Mirrors SpendEvent struct (lib.rs L68-79) */
export interface SpendActivity extends BaseActivity {
  type: 'spend';
  sender: string;          // G... strkey
  gateway: string;         // G... strkey (whitelisted relayer)
  token: string;           // C... contract strkey
  receiver: string;        // G... resolved wallet address
  receiverShortId: string; // 6-byte Base62 display string
  amount: string;          // Stroops as decimal string (i128)
  protocolToll: string;    // Stroops as decimal string (i128)
  nonce: string;           // Hex-encoded 32-byte nonce
  balance: string;         // Sender remaining vault balance
}

/** Mirrors DepositEvent struct (lib.rs L59-65) */
export interface DepositActivity extends BaseActivity {
  type: 'deposit';
  sender: string;
  token: string;
  amount: string;
  balance: string;         // New vault balance after deposit
}

/** Mirrors WithdrawEvent struct (lib.rs L88-94) */
export interface WithdrawActivity extends BaseActivity {
  type: 'withdraw';
  sender: string;
  token: string;
  amount: string;
}

/** Mirrors RecipientEvent struct (lib.rs L82-86) — used for both register + update */
export interface RecipientActivity extends BaseActivity {
  type: 'register_recipient' | 'update_recipient';
  shortId: string;   // 6-byte Base62 decoded
  receiver: string;  // G... strkey
}

/** Discriminated union of all contract event types */
export type NetworkActivity =
  | SpendActivity
  | DepositActivity
  | WithdrawActivity
  | RecipientActivity;

/** BFF API response from /api/ledger/events */
export interface LedgerEventsResponse {
  events: NetworkActivity[];
  /**
   * ID of the oldest event in this page.
   * Pass as `before=` on the next load-more request for keyset pagination.
   * (Previously an opaque Stellar RPC cursor — now a Supabase event ID.)
   */
  cursor: string;
  latestLedger: number;
  oldestLedger: number;
  /** Whether more historical events exist before the current set */
  hasMore: boolean;
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
