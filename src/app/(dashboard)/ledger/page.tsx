"use client";

import { Radio, FileText } from "lucide-react";
import { useTransactionLedger } from "@/hooks/useTransactionLedger";
import { TransactionRow } from "@/components/domain/TransactionRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/core/utils";
import type { LedgerFilter } from "@/hooks/useTransactionLedger";

const FILTER_OPTIONS: { value: LedgerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

export default function LedgerPage() {
  const {
    filteredTransactions,
    transactions,
    isLive,
    toggleLive,
    filter,
    setFilter,
    summary,
  } = useTransactionLedger();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-navy-900 font-extrabold text-2xl">
            Transaction Ledger
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {transactions.length} transactions · {summary.totalVolume} total volume
          </p>
        </div>

        {/* Live toggle */}
        <button
          id="live-toggle-btn"
          onClick={toggleLive}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-card border",
            isLive
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-white border-border-default text-slate-500 hover:bg-surface-raised"
          )}
        >
          <Radio
            className={cn("w-3.5 h-3.5", isLive && "animate-pulse")}
          />
          {isLive ? "Live" : "Paused"}
        </button>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-card text-center">
          <div className="font-mono font-bold text-lg text-green-600">
            {summary.confirmedCount}
          </div>
          <div className="text-slate-500 text-xs">Confirmed</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-card text-center">
          <div className="font-mono font-bold text-lg text-amber-500">
            {summary.pendingCount}
          </div>
          <div className="text-slate-500 text-xs">Pending</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-card text-center">
          <div className="font-mono font-bold text-lg text-red-500">
            {summary.failedCount}
          </div>
          <div className="text-slate-500 text-xs">Failed</div>
        </div>
      </div>

      {/* Filter tabs + table */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-table">
        {/* Filter bar */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-surface-raised">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              id={`filter-${value}-btn`}
              onClick={() => setFilter(value)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                filter === value
                  ? "bg-navy-900 text-white"
                  : "text-slate-500 hover:bg-surface"
              )}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto text-slate-400 text-xs font-mono">
            {filteredTransactions.length} shown
          </div>
        </div>

        {/* Table header */}
        <div
          className="grid px-6 py-2 bg-surface text-slate-400 text-[0.68rem] font-bold uppercase tracking-widest"
          style={{
            gridTemplateColumns: "28px 1fr 80px 100px 100px 90px",
            gap: "12px",
          }}
        >
          <div />
          <div>Tx Hash / Memo</div>
          <div>Amount</div>
          <div>From</div>
          <div>To</div>
          <div>Status</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-surface">
          {filteredTransactions.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={FileText}
                title="No transactions"
                description={
                  filter === "all"
                    ? "No transactions recorded yet."
                    : `No ${filter} transactions match the current filter.`
                }
              />
            </div>
          ) : (
            filteredTransactions.map((tx, idx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                isNew={isLive && idx === 0}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
