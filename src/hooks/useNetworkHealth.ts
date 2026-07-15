'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DashboardMetrics,
  DashboardOverview,
  NetworkService,
  RelayerReadiness,
  StatMetric,
  WalletInfo,
} from '@/core/types';
import { DASHBOARD_REFRESH_INTERVAL_MS } from '@/core/constants';

const EMPTY_WALLET: WalletInfo = {
  address: process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? '—',
  balancePhpc: '—',
  balanceXlm: '—',
  change24h: '—',
  fundedNodes: '—',
  totalDistributed: '—',
};

function signed(value: number, suffix = ''): string {
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

function compactXlm(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 2,
  }).format(value);
}

function buildStats(
  current: DashboardMetrics,
  previous: DashboardMetrics | null,
): StatMetric[] {
  const activeDelta = previous ? current.activeNodes - previous.activeNodes : null;
  const pendingDelta = previous && current.pendingTransactions !== null && previous.pendingTransactions !== null
    ? current.pendingTransactions - previous.pendingTransactions
    : null;
  const latencyDelta = previous && current.avgLatencyMs !== null && previous.avgLatencyMs !== null
    ? current.avgLatencyMs - previous.avgLatencyMs
    : null;

  return [
    {
      label: 'Active Nodes',
      value: current.activeNodes.toString(),
      delta: activeDelta === null ? '—' : signed(activeDelta),
      positive: activeDelta === null || activeDelta === 0 ? null : activeDelta > 0,
      iconName: 'server',
    },
    {
      label: 'Distributed XLM',
      value: compactXlm(current.distributedXlm),
      delta: current.distributedChangePct === null
        ? '—'
        : signed(Number(current.distributedChangePct.toFixed(1)), '%'),
      positive: current.distributedChangePct === null || current.distributedChangePct === 0
        ? null
        : current.distributedChangePct > 0,
      iconName: 'zap',
    },
    {
      label: 'Pending Txns',
      value: current.pendingTransactions?.toString() ?? '—',
      delta: pendingDelta === null ? '—' : signed(pendingDelta),
      positive: pendingDelta === null || pendingDelta === 0 ? null : pendingDelta < 0,
      iconName: 'activity',
    },
    {
      label: 'Avg Latency',
      value: current.avgLatencyMs === null ? '—' : `${current.avgLatencyMs}ms`,
      delta: latencyDelta === null ? '—' : signed(latencyDelta, 'ms'),
      positive: latencyDelta === null || latencyDelta === 0 ? null : latencyDelta < 0,
      iconName: 'trending-up',
    },
  ];
}

export interface UseNetworkHealthReturn {
  services: NetworkService[];
  relayers: RelayerReadiness[];
  stats: StatMetric[];
  walletInfo: WalletInfo;
  warnings: string[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => void;
  lastUpdated: Date;
}

export function useNetworkHealth(): UseNetworkHealthReturn {
  const [services, setServices] = useState<NetworkService[]>([]);
  const [relayers, setRelayers] = useState<RelayerReadiness[]>([]);
  const [stats, setStats] = useState<StatMetric[]>([]);
  const [walletInfo, setWalletInfo] = useState<WalletInfo>(EMPTY_WALLET);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const previousMetrics = useRef<DashboardMetrics | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (initial: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (initial) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const response = await fetch('/api/dashboard/overview', {
        signal: controller.signal,
        cache: 'no-store',
      });
      const data = await response.json() as DashboardOverview & { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Failed to refresh dashboard.');

      setServices(data.services);
      setRelayers(data.relayers);
      setWalletInfo(data.walletInfo);
      setWarnings(data.warnings);
      setStats(buildStats(data.metrics, previousMetrics.current));
      previousMetrics.current = data.metrics;
      setLastUpdated(new Date(data.lastUpdated));
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to refresh dashboard.');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(true);
    const interval = setInterval(() => {
      if (!document.hidden) void load(false);
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [load]);

  return {
    services,
    relayers,
    stats,
    walletInfo,
    warnings,
    isLoading,
    isRefreshing,
    error,
    refresh: () => void load(false),
    lastUpdated,
  };
}
