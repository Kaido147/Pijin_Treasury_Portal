"use client";

import { useState } from "react";
import { Server, Plus } from "lucide-react";
import { toast } from "sonner";
import type { RegistryFailureCode } from "@/hooks/useGatewayNodes";
import { useGatewayNodes } from "@/hooks/useGatewayNodes";
import { GatewayNodeCard } from "@/components/domain/GatewayNodeCard";
import { RegisterNodeForm } from "@/components/domain/RegisterNodeForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/core/utils";
import { useTransfer } from "@/hooks/useTransfer";
import { TransferForm } from "@/components/domain/TransferForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ─── Failure-Code Toast Title Map ───────────────────────

const FAILURE_TITLES: Record<RegistryFailureCode, string> = {
  RELAYER_UNFUNDED:    'Relayer Unfunded',
  RESOURCE_EXHAUSTION: 'Resource Limit Exceeded',
  STATE_COLLISION:     'Gateway Already Registered',
  AUTH_FAILED:         'Authentication Failed',
  UNKNOWN:             'Operation Failed',
};

type TabId = 'ACTIVE' | 'REVOKED';

export default function GatewayOpsPage() {
  const {
    nodes,
    activeNodes,
    revokedNodes,
    addNode,
    removeNode,
    txState,
    isSubmitting,
    isSuccess,
    isLoading,
    loadError,
  } = useGatewayNodes();

  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('ACTIVE');

  // Fund-node modal state
  const [fundDialogOpen, setFundDiaglogOpen] = useState<boolean>(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const { formState, txHash, submitTransfer, resetTransfer } = useTransfer();

  // Whether ANY revoke TX is in-flight
  const isRevoking = txState.status === 'BROADCASTING';

  // Event-driven: capture addNode return; fire toast immediately on failure
  const handleRegistration = async (data: { name: string; address: string; region: string }) => {
    const result = await addNode(data);
    if (result?.status === 'FAILED') {
      toast.error(
        FAILURE_TITLES[result.failureCode ?? 'UNKNOWN'],
        { description: result.failureMessage ?? undefined },
      );
    }
  };

  const handleRevoke = async (address: string) => {
    const result = await removeNode(address);
    if (result?.status === 'FAILED') {
      toast.error(
        FAILURE_TITLES[result.failureCode ?? 'UNKNOWN'],
        { description: result.failureMessage ?? undefined },
      );
    } else if (!result) {
      // success (void return)
      toast.success('Gateway Revoked', { description: 'Node de-whitelisted on-chain and marked inactive.' });
    }
  };

  const handleFundClick = (address: string): void => {
    setSelectedAddress(address);
    setFundDiaglogOpen(true);
  };

  const handleDialogClose = (open: boolean): void => {
    setFundDiaglogOpen(open);
    if (!open) {
      // Reset Form state when dialog is dismissed
      resetTransfer();
      setSelectedAddress(null);
    }
  };

  // Nodes to render for current tab
  const displayedNodes = activeTab === 'ACTIVE' ? activeNodes : revokedNodes;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'ACTIVE', label: 'Active', count: activeNodes.length },
    { id: 'REVOKED', label: 'Revoked', count: revokedNodes.length },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page header with register button */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-navy-900 font-extrabold text-2xl">
            Gateway Operations
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            {isLoading
              ? "Loading..."
              : `${activeNodes.length} active · ${revokedNodes.length} revoked · ${nodes.length} total`}
          </p>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setShowRegisterForm((prev) => !prev)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 lg:py-2 rounded-full text-sm font-semibold transition-all h-11 lg:h-auto",
            showRegisterForm
              ? "bg-slate-100 border border-border-default text-slate-700 hover:bg-slate-200"
              : "bg-navy-900 text-white hover:bg-navy-800 shadow-md",
          )}
        >
          <Plus className="w-4 h-4" />
          Register Node
        </button>
      </div>

      {/* Conditional Registration Form (Spans full width when visible) */}
      {showRegisterForm && (
        <RegisterNodeForm
          onSubmit={handleRegistration}
          isSubmitting={isSubmitting}
          isSuccess={isSuccess}
          revokedNodes={revokedNodes}
        />
      )}

      {/* Error State — Load */}
      {loadError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          Failed to load gateway nodes: {loadError}
        </div>
      )}

      {/* Segmented Tab Header */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id.toLowerCase()}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
              activeTab === tab.id
                ? "bg-navy-900 text-white shadow-sm"
                : "text-slate-500 hover:text-navy-900 hover:bg-white/60",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-full",
                activeTab === tab.id
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-600",
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Node List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900"></div>
          </div>
        ) : displayedNodes.length === 0 && !loadError ? (
          <EmptyState
            icon={Server}
            title={activeTab === 'ACTIVE' ? "No active nodes" : "No revoked nodes"}
            description={
              activeTab === 'ACTIVE'
                ? "Register your first gateway node using the form above."
                : "Revoked nodes will appear here after de-whitelisting."
            }
          />
        ) : (
          displayedNodes.map((node) => (
            <GatewayNodeCard
              key={node.id}
              node={node}
              onFundClick={handleFundClick}
              isRevoked={activeTab === 'REVOKED'}
              onRevokeClick={activeTab === 'ACTIVE' ? handleRevoke : undefined}
              isRevoking={isRevoking}
            />
          ))
        )}
      </div>

      {/* Fund Node Dialog */}
      <Dialog open={fundDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg p-0 overflow-hidden rounded-3xl border-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Fund Gateway Node</DialogTitle>
            <DialogDescription>
              Send XLM directly to the selected gateway node address.
            </DialogDescription>
          </DialogHeader>
          {selectedAddress !== null && (
            <TransferForm
              formState={formState}
              txHash={txHash}
              onSubmit={submitTransfer}
              onReset={resetTransfer}
              prefilledAddress={selectedAddress}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
