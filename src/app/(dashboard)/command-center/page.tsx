"use client";

import { RefreshCw } from "lucide-react";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { STAT_ICON_MAP, XLM_TO_PHP_RATE } from "@/core/constants";
import { StatCard } from "@/components/domain/StatCard";
import { WalletBalanceCard } from "@/components/domain/WalletBalanceCard";
import { NetworkHealthPanel } from "@/components/domain/NetworkHealthPanel";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { cn } from "@/core/utils";
import type { WalletInfo } from "@/core/types";

export default function CommandCenterPage() {
  const { services, stats, isRefreshing, refresh, lastUpdated } =
    useNetworkHealth();

  const { isConnected, publicKey, balance } = useStellarWallet();

  const phpValue = balance * XLM_TO_PHP_RATE;

  const liveWalletInfo: WalletInfo = {
    address: publicKey ?? '—',
    balancePhp: `₱${phpValue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    balanceXlm: balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    change24h: '—',
    fundedNodes: '—',
    totalDistributed: '—',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-navy-900 font-extrabold text-2xl">Command Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Network overview · Last updated{" "}
            {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <button
          id="refresh-btn"
          onClick={refresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-border-default text-slate-600 text-sm font-semibold transition-all hover:bg-surface-raised disabled:opacity-50 shadow-card"
        >
          <RefreshCw
            className={cn("w-4 h-4", isRefreshing && "animate-spin")}
          />
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <WalletBalanceCard walletInfo={liveWalletInfo} isConnected={isConnected} />

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isRefreshing
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((metric) => {
            const Icon = STAT_ICON_MAP[metric.iconName] ?? STAT_ICON_MAP["activity"];
            return (
              <StatCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                delta={metric.delta}
                positive={metric.positive}
                icon={Icon}
              />
            );
          })}
      </div>

      <NetworkHealthPanel services={services} />
    </div>
  );
}
