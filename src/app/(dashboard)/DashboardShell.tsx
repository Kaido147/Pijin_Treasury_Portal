"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { WalletProvider } from "@/core/providers/WalletProvider";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Close drawer by default on mobile without causing SSR hydration mismatch
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <WalletProvider>
      <div className="min-h-screen bg-surface flex">
        <Sidebar isOpen={sidebarOpen} />

        {/* Backdrop — mobile only, dismisses drawer on tap-outside */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main content area — overlaid on mobile, shifted on desktop */}
        <div
          className={[
            "flex-1 flex flex-col min-w-0 transition-all duration-300",
            sidebarOpen ? "lg:ml-60" : "lg:ml-0",
          ].join(" ")}
        >
          <Topbar
            isSidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
          />
          <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </WalletProvider>
  );
}
