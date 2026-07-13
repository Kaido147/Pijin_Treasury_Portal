'use client';

// ═══════════════════════════════════════════════════════════
// Hook: useTreasuryBalance
//
// Fetches the public XLM balance of the treasury hot wallet
// via Horizon REST API. Completely decoupled from Freighter —
// no wallet connection required.
//
// Polls every 30 s (skips when tab is hidden).
// Returns balance string formatted as "1,234.56".
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchStellarBalance } from '@/infrastructure/stellar/horizon';

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? '';
const POLL_INTERVAL_MS = 30_000;

export interface UseTreasuryBalanceReturn {
  /** Formatted XLM balance string, e.g. "1,234.56". Empty string while loading. */
  balance: string;
  /** True on initial load before first successful fetch. */
  isLoading: boolean;
  /** Error message if the last fetch failed, null otherwise. */
  error: string | null;
  /** Trigger a manual refresh (e.g. after a fund transaction completes). */
  refresh: () => void;
}

export function useTreasuryBalance(): UseTreasuryBalanceReturn {
  const [balance, setBalance] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchBalance = useCallback(async (initial: boolean = false) => {
    if (!TREASURY_ADDRESS) {
      setIsLoading(false);
      setError('NEXT_PUBLIC_TREASURY_ADDRESS is not configured.');
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (initial) setIsLoading(true);

      const result = await fetchStellarBalance(TREASURY_ADDRESS, controller.signal);

      if (isMountedRef.current && !controller.signal.aborted) {
        setBalance(result);
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch treasury balance.');
      }
    } finally {
      if (isMountedRef.current && !controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Mount: initial fetch + poll
  useEffect(() => {
    isMountedRef.current = true;
    fetchBalance(true);

    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchBalance(false);
    }, POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchBalance]);

  return { balance, isLoading, error, refresh: () => fetchBalance(false) };
}
