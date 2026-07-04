'use client';

import { Menu, X, Wallet, Loader2 } from 'lucide-react';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { truncateAddress } from '@/core/utils';

interface TopbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ isSidebarOpen, onToggleSidebar }: TopbarProps) {
  const { isConnected, isConnecting, publicKey, connect } =
    useStellarWallet();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-2 lg:px-6 lg:py-3 bg-surface/85 backdrop-blur-md border-b border-border-default">
      {/* Sidebar toggle */}
      <button
        id="sidebar-toggle-btn"
        onClick={onToggleSidebar}
        className="w-11 h-11 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl transition-colors bg-transparent hover:bg-surface-raised"
      >
        {isSidebarOpen ? (
          <X className="w-4 h-4 text-slate-500" />
        ) : (
          <Menu className="w-4 h-4 text-slate-500" />
        )}
      </button>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Network badge — always visible */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-border-default">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-slate-500 text-xs font-semibold">
            Stellar Testnet
          </span>
        </div>

        {/* Wallet state — conditional rendering */}
        {isConnected && publicKey ? (
          <>
            {/* Truncated address avatar — balance removed */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-border-default">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-slate-500 text-[0.7rem] font-mono font-medium">
                {truncateAddress(publicKey, 6, 4)}
              </span>
            </div>
          </>
        ) : (
          <button
            id="topbar-connect-wallet-btn"
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-900 text-white text-xs font-bold transition-colors hover:bg-navy-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wallet className="w-3.5 h-3.5" />
            )}
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </header>
  );
}
