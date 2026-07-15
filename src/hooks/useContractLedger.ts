// ═══════════════════════════════════════════════════════════
// Hook: useContractLedger
//
// Fetches and manages Soroban smart contract events.
// Events now come from Supabase (permanent store), not directly
// from Stellar RPC.
//
// Data flow:
//   Mount / filter change:
//     1. POST /api/ledger/index   → populates DB from RPC (await)
//     2. GET  /api/ledger/events  → reads from DB
//   Every 10s poll tick:
//     1. POST /api/ledger/index   → fire-and-forget (non-blocking)
//     2. GET  /api/ledger/events  → fresh read from DB (dedup handles repeats)
//   Load-more:
//     GET /api/ledger/events?before=<cursor> → older page from DB
//
// Cursor design:
//   loadMoreCursor — Supabase event ID of the oldest loaded event.
//                    Passed as `before=` to fetch older history.
//                    Written only on non-poll fetches.
//                    Never touched by the poll interval.
//
// Filter:
//   filter state drives a server-side `type=` query param.
//   Changing filter resets all loaded events and re-fetches from scratch.
//
// Race protection:
//   initialLoadDoneRef prevents the poll interval from firing before
//   the initial DB read completes (including the preceding indexer call).
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
  /** Activities filtered by the current ActivityFilter (client-side pass-through) */
  filteredActivities: NetworkActivity[];
  /** Whether live polling is active */
  isLive: boolean;
  /** Toggle live polling on/off */
  toggleLive: () => void;
  /** Current filter */
  filter: ActivityFilter;
  /** Set the active filter — triggers server-side re-fetch with reset */
  setFilter: (f: ActivityFilter) => void;
  /** Whether the initial load is in progress */
  isLoading: boolean;
  /** Error message if the last fetch failed */
  error: string | null;
  /** Load the next page of older historical events */
  loadMore: () => void;
  /** Whether more historical events exist before the current set */
  hasMore: boolean;
  /** Derived summary KPIs (scoped to the current filter's loaded events) */
  summary: {
    totalVolume: string;    // Sum of spend amounts (stroops decimal string)
    totalTolls: string;     // Sum of protocol tolls (stroops decimal string)
    activeGateways: number; // Unique gateway address count
    totalEvents: number;    // Total events currently loaded
  };
}

// ─── Hook ────────────────────────────────────────────────

/**
 * Provides persistent contract event data with live polling and filtering.
 *
 * Usage:
 * ```tsx
 * const { filteredActivities, isLive, toggleLive, filter, setFilter, summary } =
 *   useContractLedger();
 * ```
 */
export function useContractLedger(): UseContractLedgerReturn {
  const [activities, setActivities]         = useState<NetworkActivity[]>([]);
  const [isLive, setIsLive]                 = useState(true);
  const [filter, setFilter]                 = useState<ActivityFilter>('all');
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [loadMoreCursor, setLoadMoreCursor] = useState<string>('');
  const [hasMore, setHasMore]               = useState(false);

  // Guards poll from running before initial indexer+load sequence completes.
  // Also reset to false when filter changes (during re-fetch).
  const initialLoadDoneRef = useRef<boolean>(false);

  // ─── Indexer trigger ───────────────────────────────────

  /**
   * Asks the server to sync new on-chain events into Supabase.
   * Resolves when the indexer write completes (used sequentially on mount).
   * Errors are logged as warnings — indexer failure is non-fatal for read path,
   * but visible to developers for observability (`/api-design-principles`).
   */
  const triggerIndexer = useCallback(async () => {
    try {
      const res = await fetch('/api/ledger/index', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn(
          `[useContractLedger] Indexer sync warning (HTTP ${res.status}):`,
          body.error || res.statusText,
        );
      }
    } catch (err: unknown) {
      console.warn('[useContractLedger] Failed to reach /api/ledger/index:', err);
    }
  }, []);

  // ─── Fetch helper ──────────────────────────────────────

  const fetchEvents = useCallback(
    async (opts: {
      /** Keyset cursor — event ID. Fetch events older than this (load-more). */
      before?: string;
      /** true → prepend new events to top; false → append to bottom (load-more). */
      prepend?: boolean;
    }) => {
      try {
        const params = new URLSearchParams({ limit: String(CONTRACT_EVENT_LIMIT) });
        if (opts.before) params.set('before', opts.before);
        // Server-side type filter — reduces payload when filter is active
        if (filter !== 'all') params.set('type', filter);

        const res = await fetch(`/api/ledger/events?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }

        const data: LedgerEventsResponse = await res.json();

        setActivities((prev) => {
          const next = opts.prepend
            ? [...data.events, ...prev]  // poll: new events go to top
            : [...prev, ...data.events]; // load-more: older events appended

          // Dedup by event ID while preserving order (and never deleting existing state items)
          const map = new Map<string, NetworkActivity>();
          for (const a of next) {
            if (!map.has(a.id)) {
              map.set(a.id, a);
            }
          }
          return Array.from(map.values());
        });

        // cursor = oldest event ID in this page (for load-more keyset pagination)
        // Only update on non-poll fetches — polling must not move the load-more cursor.
        if (!opts.prepend) {
          if (data.cursor) setLoadMoreCursor(data.cursor);
          setHasMore(data.hasMore);
        }

        setError(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.error('[useContractLedger] fetch error:', msg);
      }
    },
    [filter],
  );

  // ─── Initial load + filter-change effect ───────────────
  //
  // Runs on mount and whenever filter changes.
  // Sequence:
  //   1. Reset all state (clear events, cursors, seenIds)
  //   2. Await indexer POST (ensures DB has fresh on-chain events)
  //   3. Read events from DB
  //
  // fetchEvents is intentionally omitted from deps — it changes
  // whenever filter changes (same dep), so including it would create
  // a redundant re-run. ESLint suppressed below.

  useEffect(() => {
    let isMounted = true;

    // Reset loaded state
    setActivities([]);
    setLoadMoreCursor('');
    setHasMore(false);
    setIsLoading(true);
    initialLoadDoneRef.current = false;

    const init = async () => {
      // Step 1: populate DB with latest on-chain events before reading
      await triggerIndexer();
      // Step 2: read from DB
      await fetchEvents({});
      if (isMounted) {
        setIsLoading(false);
        initialLoadDoneRef.current = true;
      }
    };

    init();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // ─── Live polling ──────────────────────────────────────
  //
  // Poll interval fires every CONTRACT_EVENT_POLL_MS (10 s).
  // Each tick:
  //   1. Fire-and-forget POST /api/ledger/index (index new on-chain events)
  //   2. GET  /api/ledger/events (read from DB — dedup handles overlap)
  //
  // Guards:
  //   - initialLoadDoneRef: skips ticks while initial load is running
  //   - isLive:             interval only created while live mode is on

  useEffect(() => {
    if (!isLive) return;

    const id = setInterval(async () => {
      if (!initialLoadDoneRef.current) return; // initial load not done yet

      // Non-blocking indexer sync — do NOT await, and errors are handled inside triggerIndexer
      triggerIndexer();

      // Fresh DB read — prepend any new events (dedup removes duplicates)
      await fetchEvents({ prepend: true });
    }, CONTRACT_EVENT_POLL_MS);

    return () => clearInterval(id);
  }, [isLive, fetchEvents, triggerIndexer]);

  // ─── Load more (infinite scroll) ──────────────────────
  //
  // Fetches events with ID < loadMoreCursor (older than current set).
  // Uses `before=` keyset pagination — O(1) at any depth.

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    fetchEvents({ before: loadMoreCursor, prepend: false });
  }, [loadMoreCursor, fetchEvents, hasMore, isLoading]);

  // ─── Filtering (client-side pass-through) ─────────────
  //
  // Server already filtered by type — this useMemo is a lightweight
  // pass-through. Kept so the returned interface is unchanged and the
  // component doesn't need updating.

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter((a) => a.type === filter);
  }, [activities, filter]);

  // ─── Derived summary KPIs ─────────────────────────────
  //
  // KPIs are scoped to the events currently loaded (filtered by type
  // if a filter is active). This is intentional — "Total Volume" when
  // filter=spend shows spend-only volume, which is meaningful.

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
