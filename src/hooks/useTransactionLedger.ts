// ═══════════════════════════════════════════════════════════
// Hook: useTransactionLedger
//
// Manages the transaction list, live polling, and filtering.
// Generates mock transactions on a 5-second interval when
// "live" mode is enabled — ready to swap to WebSocket or
// Horizon streaming API for production.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Transaction, TxStatus } from '@/core/types';
import {
  generateMockTransaction,
  generateInitialTransactions,
} from '@/infrastructure/api/mockData';
import {
  LEDGER_POLL_INTERVAL_MS,
  LEDGER_MAX_TRANSACTIONS,
  LEDGER_INITIAL_COUNT,
} from '@/core/constants';

export type LedgerFilter = TxStatus | 'all';

export interface UseTransactionLedgerReturn {
  /** Full unfiltered transaction list */
  transactions: Transaction[];
  /** Transactions filtered by the current status filter */
  filteredTransactions: Transaction[];
  /** Whether live polling is active */
  isLive: boolean;
  /** Toggle live polling on/off */
  toggleLive: () => void;
  /** Current filter value */
  filter: LedgerFilter;
  /** Set the active filter */
  setFilter: (filter: LedgerFilter) => void;
  /** Summary stats derived from the full transaction list */
  summary: {
    totalVolume: string;
    confirmedCount: number;
    pendingCount: number;
    failedCount: number;
  };
}

/**
 * Provides transaction ledger data with live polling and filtering.
 *
 * Usage:
 * ```tsx
 * const {
 *   filteredTransactions, isLive, toggleLive,
 *   filter, setFilter, summary,
 * } = useTransactionLedger();
 * ```
 *
 * When replacing mock with real data:
 * - Swap `generateInitialTransactions` with a fetch call
 * - Replace the `setInterval` with a Horizon streaming connection
 *   or WebSocket subscription
 * - No component changes required
 */
export function useTransactionLedger(): UseTransactionLedgerReturn {
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    generateInitialTransactions(LEDGER_INITIAL_COUNT),
  );
  const [isLive, setIsLive] = useState(true);
  const [filter, setFilter] = useState<LedgerFilter>('all');

  // ─── Live Polling ───────────────────────────────────────
  // When live mode is on, prepend a new transaction every 5s
  // and cap the list at LEDGER_MAX_TRANSACTIONS.
  useEffect(() => {
    if (!isLive) return;

    const intervalId = setInterval(() => {
      if (document.hidden) return;
      setTransactions((prev) =>
        [generateMockTransaction(0), ...prev].slice(
          0,
          LEDGER_MAX_TRANSACTIONS,
        ),
      );
    }, LEDGER_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isLive]);

  // ─── Filtering ──────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((tx) => tx.status === filter);
  }, [transactions, filter]);

  // ─── Derived Summary ────────────────────────────────────
  const summary = useMemo(() => {
    const totalVolume = (
      transactions.reduce((acc, tx) => acc + parseFloat(tx.amount), 0) / 1000
    ).toFixed(1);

    return {
      totalVolume: `${totalVolume}K XLM`,
      confirmedCount: transactions.filter((tx) => tx.status === 'confirmed')
        .length,
      pendingCount: transactions.filter((tx) => tx.status === 'pending')
        .length,
      failedCount: transactions.filter((tx) => tx.status === 'failed').length,
    };
  }, [transactions]);

  // ─── Actions ────────────────────────────────────────────
  const toggleLive = useCallback(() => {
    setIsLive((prev) => !prev);
  }, []);

  return {
    transactions,
    filteredTransactions,
    isLive,
    toggleLive,
    filter,
    setFilter,
    summary,
  };
}
