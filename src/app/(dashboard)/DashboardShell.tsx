"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { WalletProvider } from "@/core/providers/WalletProvider";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <WalletProvider>
      <div className="min-h-screen bg-surface flex">
        <Sidebar isOpen={sidebarOpen} />

        {/* Main content area — shifts right when sidebar open */}
        <div
          className="flex-1 flex flex-col min-w-0 transition-all duration-300"
          style={{ marginLeft: sidebarOpen ? "240px" : "0px" }}
        >
          <Topbar
            isSidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
          />
          <main className="flex-1 px-6 py-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </WalletProvider>
  );
}
