// ═══════════════════════════════════════════════════════════
// Hook: useContractLedger
//
// Fetches and manages Soroban smart contract events from the
// /api/ledger/events BFF route.
//
// Key differences from the legacy useTransactionLedger:
//  - No wallet dependency — works without Freighter connected
//  - Initialises immediately on mount using CONTRACT_ID (server-side)
//  - Uses cursor-based pagination for infinite scroll (load-more)
//  - Live mode polls every 10s using the latest cursor (no SSE)
//  - Returns NetworkActivity[] not Transaction[]
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  NetworkActivity,
  SpendActivity,
  ActivityFilter,
  LedgerEventsResponse,
} from '@/core/types';
import { CONTRACT_EVENT_POLL_MS, CONTRACT_EVENT_LIMIT } from '@/core/constants';

// ─── Public interface ────────────────────────────────────

export type { ActivityFilter };

export interface UseContractLedgerReturn {
  /** Full, deduplicated activity list (newest first) */
  activities: NetworkActivity[];
  /** Activities filtered by the current ActivityFilter */
  filteredActivities: NetworkActivity[];
  /** Whether live polling is active */
  isLive: boolean;
  /** Toggle live polling on/off */
  toggleLive: () => void;
  /** Current filter */
  filter: ActivityFilter;
  /** Set the active filter */
  setFilter: (f: ActivityFilter) => void;
  /** Whether the initial load is in progress */
  isLoading: boolean;
  /** Error message if the last fetch failed */
  error: string | null;
  /** Load the next page of older historical events */
  loadMore: () => void;
  /** Whether more historical events exist before the current set */
  hasMore: boolean;
  /** Derived summary KPIs from the full activity list */
  summary: {
    totalVolume: string;    // Sum of all spend amounts (in stroops as string)
    totalTolls: string;     // Sum of all protocol tolls (in stroops as string)
    activeGateways: number; // Count of unique gateway addresses
    totalEvents: number;    // Total number of events loaded
  };
}

// ─── Hook ────────────────────────────────────────────────

/**
 * Provides contract event data with live polling and filtering.
 *
 * Usage:
 * ```tsx
 * const { filteredActivities, isLive, toggleLive, filter, setFilter, summary } =
 *   useContractLedger();
 * ```
 */
export function useContractLedger(): UseContractLedgerReturn {
  const [activities, setActivities] = useState<NetworkActivity[]>([]);
  const [seenIds]                   = useState(() => new Set<string>());
  const [isLive, setIsLive]         = useState(true);
  const [filter, setFilter]         = useState<ActivityFilter>('all');
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [cursor, setCursor]         = useState<string>('');
  const [hasMore, setHasMore]       = useState(false);

  // Stable ref for the latest cursor — avoids stale closures in the poll loop
  const cursorRef = useRef<string>('');
  cursorRef.current = cursor;

  // ─── Fetch helper ──────────────────────────────────────

  const fetchEvents = useCallback(
    async (opts: { cursor?: string; prepend?: boolean }) => {
      try {
        const params = new URLSearchParams({ limit: String(CONTRACT_EVENT_LIMIT) });
        if (opts.cursor) params.set('cursor', opts.cursor);

        const res = await fetch(`/api/ledger/events?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const data: LedgerEventsResponse = await res.json();

        setActivities((prev) => {
          const next = opts.prepend
            ? [...data.events, ...prev] // new live events go to top
            : [...prev, ...data.events]; // load-more appends to bottom

          // Deduplicate using the Set (updates seenIds as a side-effect)
          return next.filter((a) => {
            if (seenIds.has(a.id)) return false;
            seenIds.add(a.id);
            return true;
          });
        });

        // Only update cursor / hasMore on non-poll fetches
        // (polling returns prepend=true and we want the cursor to advance)
        if (data.cursor) setCursor(data.cursor);
        if (!opts.prepend) setHasMore(data.hasMore);

        setError(null);
        return data.cursor;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('[useContractLedger] fetch error:', msg);
        return null;
      }
    },
    [seenIds],
  );

  // ─── Initial load ──────────────────────────────────────

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchEvents({}).finally(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Live polling ──────────────────────────────────────

  useEffect(() => {
    if (!isLive) return;

    const id = setInterval(async () => {
      // Use the ref so we always have the latest cursor without re-creating the interval
      if (cursorRef.current) {
        await fetchEvents({ cursor: cursorRef.current, prepend: true });
      }
    }, CONTRACT_EVENT_POLL_MS);

    return () => clearInterval(id);
  }, [isLive, fetchEvents]);

  // ─── Load more (infinite scroll) ──────────────────────

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    fetchEvents({ cursor, prepend: false });
  }, [cursor, fetchEvents, hasMore, isLoading]);

  // ─── Filtering ────────────────────────────────────────

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter((a) => a.type === filter);
  }, [activities, filter]);

  // ─── Derived summary KPIs ─────────────────────────────

  const summary = useMemo(() => {
    const spends = activities.filter(
      (a): a is SpendActivity => a.type === 'spend',
    );

    const totalVolumeBigInt = spends.reduce(
      (acc, s) => acc + BigInt(s.amount),
      BigInt(0),
    );
    const totalTollsBigInt = spends.reduce(
      (acc, s) => acc + BigInt(s.protocolToll),
      BigInt(0),
    );
    const activeGateways = new Set(spends.map((s) => s.gateway)).size;

    return {
      totalVolume:    totalVolumeBigInt.toString(),
      totalTolls:     totalTollsBigInt.toString(),
      activeGateways,
      totalEvents:    activities.length,
    };
  }, [activities]);

  // ─── Actions ──────────────────────────────────────────

  const toggleLive = useCallback(() => setIsLive((prev) => !prev), []);

  return {
    activities,
    filteredActivities,
    isLive,
    toggleLive,
    filter,
    setFilter,
    isLoading,
    error,
    loadMore,
    hasMore,
    summary,
  };
}
