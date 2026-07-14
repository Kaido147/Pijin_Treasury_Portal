"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Radio, FileText, Search, TrendingUp, Zap, Network } from "lucide-react";
import { useContractLedger } from "@/hooks/useContractLedger";
import { ActivityRow } from "@/components/domain/ActivityRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/core/utils";
import { CONTRACT_TOKEN_CONFIG } from "@/core/constants";
import type { ActivityFilter } from "@/core/types";

// ─── Filter options ──────────────────────────────────────

const FILTER_OPTIONS: { value: ActivityFilter; label: string }[] = [
  { value: "all",                label: "All" },
  { value: "spend",              label: "Spends" },
  { value: "deposit",           label: "Deposits" },
  { value: "withdraw",          label: "Withdrawals" },
  { value: "register_recipient", label: "Registrations" },
  { value: "update_recipient",  label: "Updates" },
];

// ─── KPI Card ────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  colorClass,
  bgClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", bgClass)}>
        <Icon className={cn("w-4 h-4", colorClass)} />
      </div>
      <div className="min-w-0">
        <div className={cn("font-mono font-bold text-lg leading-tight truncate", colorClass)}>
          {value}
        </div>
        <div className="text-slate-500 text-xs">{label}</div>
        {sub && <div className="text-slate-400 text-[0.65rem]">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Raw token amount format helper (display only) ──────

function formatTokenDisplay(raw: string): string {
  try {
    const v = BigInt(raw);
    const divisor = Math.pow(10, CONTRACT_TOKEN_CONFIG.DECIMALS);
    const amount = Number(v) / divisor;
    const sym = CONTRACT_TOKEN_CONFIG.SYMBOL;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M ${sym}`;
    if (amount >= 1_000)     return `${(amount / 1_000).toFixed(2)}K ${sym}`;
    return `${amount.toFixed(2)} ${sym}`;
  } catch {
    return `${raw} raw`;
  }
}

// ─── Page ────────────────────────────────────────────────

export default function LedgerPage() {
  const {
    filteredActivities,
    activities,
    isLive,
    toggleLive,
    filter,
    setFilter,
    isLoading,
    error,
    loadMore,
    hasMore,
    summary,
  } = useContractLedger();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  // ─── Search filter ──────────────────────────────────────
  const searchedActivities = filteredActivities.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (a.txHash.toLowerCase().includes(q)) return true;
    if ("sender"          in a && a.sender.toLowerCase().includes(q))   return true;
    if ("receiver"        in a && a.receiver.toLowerCase().includes(q)) return true;
    if ("receiverShortId" in a && a.receiverShortId.toLowerCase().includes(q)) return true;
    if ("shortId"         in a && a.shortId.toLowerCase().includes(q)) return true;
    return false;
  });

  // ─── Row expansion ──────────────────────────────────────
  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // ─── Infinite scroll sentinel ────────────────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <div>
          <h1 className="text-navy-900 font-extrabold text-2xl">
            Network Activity Ledger
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {activities.length} events · live contract monitor
          </p>
        </div>

        {/* Right controls */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              id="ledger-search-input"
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              placeholder="Search hash, address, short ID…"
              className="pl-8 pr-3 py-2 text-base lg:text-xs rounded-xl border border-border-default bg-white text-navy-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20 w-full lg:w-52 shadow-card transition-all"
            />
          </div>

          {/* Live toggle */}
          <button
            id="live-toggle-btn"
            onClick={toggleLive}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-card border",
              isLive
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-border-default text-slate-500 hover:bg-surface-raised",
            )}
          >
            <Radio className={cn("w-3.5 h-3.5", isLive && "animate-pulse")} />
            {isLive ? "Live" : "Paused"}
          </button>
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Total Network Volume"
          value={formatTokenDisplay(summary.totalVolume)}
          icon={TrendingUp}
          colorClass="text-green-600"
          bgClass="bg-green-100"
        />
        <KpiCard
          label="Total Tolls Collected"
          value={formatTokenDisplay(summary.totalTolls)}
          icon={Zap}
          colorClass="text-blue-600"
          bgClass="bg-blue-100"
        />
        <KpiCard
          label="Active Gateways"
          value={String(summary.activeGateways)}
          sub={`${summary.totalEvents} total events`}
          icon={Network}
          colorClass="text-purple-600"
          bgClass="bg-purple-100"
        />
      </div>

      {/* ── Filter tabs + table ─────────────────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-table">
        {/* Filter bar */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-surface-raised overflow-x-auto">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              id={`filter-${value}-btn`}
              onClick={() => setFilter(value)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                filter === value
                  ? "bg-navy-900 text-white"
                  : "text-slate-500 hover:bg-surface",
              )}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto text-slate-400 text-xs font-mono shrink-0">
            {searchedActivities.length} shown
          </div>
        </div>

        {/* Table header (desktop) */}
        <div
          className="hidden lg:grid px-6 py-2 bg-surface text-slate-400 text-[0.68rem] font-bold uppercase tracking-widest"
          style={{ gridTemplateColumns: "28px 1fr auto auto auto" }}
        >
          <div />
          <div>Event / Time</div>
          <div>Amount</div>
          <div>Type</div>
          <div />
        </div>

        {/* Error state */}
        {error && !isLoading && (
          <div className="px-6 py-4 bg-red-50 border-b border-red-100">
            <p className="text-red-600 text-sm font-medium">
              Failed to load contract events: {error}
            </p>
            <p className="text-red-400 text-xs mt-0.5">
              Live polling is paused. Check your network or RPC endpoint.
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && searchedActivities.length === 0 && (
          <div className="divide-y divide-surface">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-6 py-4 animate-pulse"
              >
                <div className="w-7 h-7 rounded-xl bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-16" />
              </div>
            ))}
          </div>
        )}

        {/* Activity rows */}
        {!isLoading && searchedActivities.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={FileText}
              title="No contract events"
              description={
                filter === "all"
                  ? "No events have been emitted by this contract yet."
                  : `No ${filter.replace("_", " ")} events match the current filter.`
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-surface">
            {searchedActivities.map((activity, idx) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                isNew={isLive && idx === 0}
                isExpanded={expandedId === activity.id}
                onToggle={() => handleToggle(activity.id)}
              />
            ))}
          </div>
        )}

        {/* Load more / Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-4">
            <button
              id="load-more-btn"
              onClick={loadMore}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
            >
              Load older events…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
