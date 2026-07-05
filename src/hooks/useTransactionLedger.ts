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
import { fetchRecentTransactions, subscribeToTransactions } from '@/infrastructure/stellar/horizon';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import {
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
  const { publicKey } = useStellarWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [isLoading, setIsLoading] = useState(false);

  // ─── Initial Load ────────────────────────────────────────
  useEffect(() => {
    if (!publicKey) {
      setTransactions([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    fetchRecentTransactions(publicKey, LEDGER_INITIAL_COUNT).then((txs) => {
      if (isMounted) {
        setTransactions(txs);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [publicKey]);

  // ─── Live Polling (SSE Stream) ───────────────────────────
  useEffect(() => {
    if (!isLive || !publicKey) return;

    const unsubscribe = subscribeToTransactions(
      publicKey,
      (newTx) => {
        setTransactions((prev) => {
          // Prevent duplicates by hash
          if (prev.some((tx) => tx.hash === newTx.hash)) {
            return prev;
          }
          return [newTx, ...prev].slice(0, LEDGER_MAX_TRANSACTIONS);
        });
      },
      (err) => {
        // Handle error if needed (maybe toast)
        console.error('Ledger stream error:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isLive, publicKey]);

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
