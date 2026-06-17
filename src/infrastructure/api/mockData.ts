// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Mock Data Generators
//
// All static/mock data lives here. When ready for production,
// replace these functions with actual API calls (fetch, GraphQL,
// or Soroban RPC queries). The hooks that consume this module
// will not need to change — only the internal implementation
// of each function swaps from mock → real.
// ═══════════════════════════════════════════════════════════

import type {
  GatewayNode,
  Transaction,
  TxType,
  TxStatus,
  NetworkService,
  StatMetric,
  WalletInfo,
} from '@/core/types';
import {
  STELLAR_ADDRESSES,
  ADMIN_ADDRESS,
  TRANSACTION_MEMOS,
} from '@/core/constants';
import { generateHash, generateAmount } from '@/core/utils';

// ─── Gateway Nodes ──────────────────────────────────────

/** Returns the initial set of gateway nodes */
export function getMockGatewayNodes(): GatewayNode[] {
  return [
    {
      id: 'node-001',
      name: 'Manila Gateway Alpha',
      address: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZUOZ7DOE5KQPBSM3YAFM',
      region: 'SEA-01',
      status: 'active',
      uptime: '99.8%',
      balance: '2,140.00',
    },
    {
      id: 'node-002',
      name: 'Jakarta Relay Beta',
      address: 'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBLAOPV7P5PL',
      region: 'SEA-02',
      status: 'active',
      uptime: '97.2%',
      balance: '1,850.75',
    },
    {
      id: 'node-003',
      name: 'Cebu Node Gamma',
      address: 'GBRMB7MFPND5JLXDTUKJBWWKUVCLMKNM3MJ2QGJCYZLBM6OBG6HRWKN',
      region: 'SEA-03',
      status: 'syncing',
      uptime: '82.1%',
      balance: '500.00',
    },
    {
      id: 'node-004',
      name: 'Singapore Hub Delta',
      address: 'GDQJUTQYK2MQX2DGUUVEXC3ZRWLN4VNTXF7SSZXATRKM6HGS5COFBKR',
      region: 'SEA-04',
      status: 'offline',
      uptime: '0%',
      balance: '0.00',
    },
  ];
}

// ─── Transactions ───────────────────────────────────────

function randomAddress(): string {
  return STELLAR_ADDRESSES[
    Math.floor(Math.random() * STELLAR_ADDRESSES.length)
  ];
}

function randomMemo(): string {
  return TRANSACTION_MEMOS[
    Math.floor(Math.random() * TRANSACTION_MEMOS.length)
  ];
}

/**
 * Generate a single mock transaction.
 * @param offset — Minutes offset from now (for staggering timestamps)
 */
export function generateMockTransaction(offset = 0): Transaction {
  const type: TxType = Math.random() > 0.35 ? 'debit' : 'credit';
  const statuses: TxStatus[] = [
    'confirmed',
    'confirmed',
    'confirmed',
    'pending',
    'failed',
  ];
  const ts = new Date(
    Date.now() - offset * 60000 * (1 + Math.random() * 4),
  );

  return {
    id: generateHash().slice(0, 8),
    hash: generateHash(),
    type,
    amount: generateAmount(),
    from: type === 'debit' ? ADMIN_ADDRESS : randomAddress(),
    to: type === 'debit' ? randomAddress() : ADMIN_ADDRESS,
    memo: randomMemo(),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    ts,
  };
}

/**
 * Generate an initial batch of mock transactions.
 * Each successive transaction is offset further in the past.
 */
export function generateInitialTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, i) =>
    generateMockTransaction(i * 3),
  );
}

// ─── Network Health ─────────────────────────────────────

/** Returns mock network service status data */
export function getMockNetworkServices(): NetworkService[] {
  return [
    { name: 'Gateway API', status: 'operational', uptime: 99.9 },
    { name: 'Liquidity Bridge', status: 'operational', uptime: 98.1 },
    { name: 'Stellar Horizon', status: 'degraded', uptime: 71.3 },
    { name: 'Agent Relay Network', status: 'operational', uptime: 95.6 },
  ];
}

// ─── Dashboard Stats ────────────────────────────────────

/** Returns the four KPI metrics for the Command Center */
export function getMockStats(): StatMetric[] {
  return [
    {
      label: 'Active Nodes',
      value: '14',
      delta: '+2',
      positive: true,
      iconName: 'server',
    },
    {
      label: 'Distributed XLM',
      value: '1.2M',
      delta: '+5.8%',
      positive: true,
      iconName: 'zap',
    },
    {
      label: 'Pending Txns',
      value: '3',
      delta: '-1',
      positive: true,
      iconName: 'activity',
    },
    {
      label: 'Avg Latency',
      value: '240ms',
      delta: '+12ms',
      positive: false,
      iconName: 'trending-up',
    },
  ];
}

// ─── Wallet Info ────────────────────────────────────────

/** Returns the admin wallet summary for the Command Center hero card */
export function getMockWalletInfo(): WalletInfo {
  return {
    address: ADMIN_ADDRESS,
    balancePhp: '₱144,370.41',
    balanceXlm: '24,891.45',
    change24h: '+128.40 XLM',
    fundedNodes: '14 active',
    totalDistributed: '1.2M XLM',
  };
}
