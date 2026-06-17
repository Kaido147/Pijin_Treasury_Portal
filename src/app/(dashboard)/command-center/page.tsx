"use client";

import { RefreshCw } from "lucide-react";
import { useNetworkHealth } from "@/hooks/useNetworkHealth";
import { STAT_ICON_MAP } from "@/core/constants";
import { StatCard } from "@/components/domain/StatCard";
import { WalletBalanceCard } from "@/components/domain/WalletBalanceCard";
import { NetworkHealthPanel } from "@/components/domain/NetworkHealthPanel";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { cn } from "@/core/utils";

export default function CommandCenterPage() {
  const { services, stats, walletInfo, isRefreshing, refresh, lastUpdated } =
    useNetworkHealth();

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

      <WalletBalanceCard walletInfo={walletInfo} isConnected={true} />

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

      {/* Hero row: wallet card + network health */}

      <NetworkHealthPanel services={services} />
    </div>

  );
}
