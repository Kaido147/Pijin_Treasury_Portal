"use client";

import { useState } from "react";
import { Server, Plus } from "lucide-react";
import { useGatewayNodes } from "@/hooks/useGatewayNodes";
import { GatewayNodeCard } from "@/components/domain/GatewayNodeCard";
import { RegisterNodeForm } from "@/components/domain/RegisterNodeForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/core/utils";

export default function GatewayOpsPage() {
  const { nodes, addNode, isSubmitting, isSuccess, isLoading, error } = useGatewayNodes();
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Calculate stats dynamically
  const activeNodesCount = nodes.filter((node) => node.status === "active").length;
  const totalNodesCount = nodes.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page header with dynamic count & register button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-navy-900 font-extrabold text-2xl">Gateway Operations</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">
            {isLoading ? "Loading..." : `${activeNodesCount} of ${totalNodesCount} nodes active`}
          </p>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setShowRegisterForm((prev) => !prev)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            showRegisterForm
              ? "bg-slate-100 border border-border-default text-slate-700 hover:bg-slate-200"
              : "bg-navy-900 text-white hover:bg-navy-800 shadow-md"
          )}
        >
          <Plus className="w-4 h-4" />
          Register Node
        </button>
      </div>

      {/* Conditional Registration Form (Spans full width when visible) */}
      {showRegisterForm && (
        <RegisterNodeForm
          onSubmit={addNode}
          isSubmitting={isSubmitting}
          isSuccess={isSuccess}
        />
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          Failed to load gateway nodes: {error}
        </div>
      )}

      {/* Node List (Spans full width, stacked in a column with space-y-3) */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900"></div>
          </div>
        ) : nodes.length === 0 && !error ? (
          <EmptyState
            icon={Server}
            title="No nodes registered"
            description="Register your first gateway node using the form."
          />
        ) : (
          nodes.map((node) => (
            <GatewayNodeCard key={node.id} node={node} />
          ))
        )}
      </div>
    </div>
  );
}
