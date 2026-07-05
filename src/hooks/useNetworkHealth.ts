// ═══════════════════════════════════════════════════════════
// Hook: useNetworkHealth
//
// Provides the Command Center with network health, KPI stats,
// wallet info, and a manual refresh action.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NetworkService, StatMetric, WalletInfo } from '@/core/types';
import {
  getMockNetworkServices,
  getMockStats,
  getMockWalletInfo,
} from '@/infrastructure/api/mockData';
import { DASHBOARD_REFRESH_INTERVAL_MS } from '@/core/constants';

export interface UseNetworkHealthReturn {
  /** Network service status list */
  services: NetworkService[];
  /** KPI stat cards data */
  stats: StatMetric[];
  /** Admin wallet summary */
  walletInfo: WalletInfo;
  /** True during a manual refresh cycle */
  isRefreshing: boolean;
  /** Trigger a manual data refresh */
  refresh: () => void;
  /** Timestamp of last data update */
  lastUpdated: Date;
}

/**
 * Provides all Command Center data and refresh logic.
 *
 * Usage:
 * ```tsx
 * const {
 *   services, stats, walletInfo,
 *   isRefreshing, refresh, lastUpdated,
 * } = useNetworkHealth();
 * ```
 *
 * When replacing mock with real data:
 * - Swap getMockNetworkServices/Stats/WalletInfo with fetch calls
 * - The refresh function can trigger a re-fetch or cache invalidation
 * - No component changes required
 */
export function useNetworkHealth(): UseNetworkHealthReturn {
  const [services, setServices] = useState<NetworkService[]>(() =>
    getMockNetworkServices(),
  );
  const [stats, setStats] = useState<StatMetric[]>(() => getMockStats());
  const [walletInfo, setWalletInfo] = useState<WalletInfo>(() =>
    getMockWalletInfo(),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  // ─── Auto-refresh timestamp ─────────────────────────────
  // Updates the "last updated" timestamp every 30s to keep
  // the UI feeling alive. In production, this would trigger
  // actual data re-fetches.
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      setLastUpdated(new Date());
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  // ─── Manual Refresh ─────────────────────────────────────
  const refresh = useCallback(() => {
    setIsRefreshing(true);

    // Simulate API re-fetch delay
    setTimeout(() => {
      setServices(getMockNetworkServices());
      setStats(getMockStats());
      setWalletInfo(getMockWalletInfo());
      setLastUpdated(new Date());
      setIsRefreshing(false);
    }, 1200);
  }, []);

  return {
    services,
    stats,
    walletInfo,
    isRefreshing,
    refresh,
    lastUpdated,
  };
}
