'use client';

import { useState } from 'react';
import { Menu, X, Wallet, Loader2, Copy, Check, Link2Off } from 'lucide-react';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { truncateAddress } from '@/core/utils';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface TopbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ isSidebarOpen, onToggleSidebar }: TopbarProps) {
  const { isConnected, isConnecting, publicKey, balance, connect, disconnect } =
    useStellarWallet();

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy address', e);
    }
  };

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
          <Popover>
            <PopoverTrigger asChild>
              <button
                id="topbar-wallet-popover-trigger"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-border-default hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-slate-500 text-[0.7rem] font-mono font-medium">
                  {truncateAddress(publicKey, 6, 4)}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 border border-border-default bg-white shadow-lg rounded-2xl">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-slate-900 font-bold text-sm">Stellar Wallet</span>
                  </div>
                  <span className="px-2 py-0.5 text-[0.65rem] font-bold text-emerald-600 bg-emerald-50 rounded-full border border-emerald-100">
                    Connected
                  </span>
                </div>

                {/* Address Box */}
                <div className="space-y-1">
                  <div className="text-slate-400 text-[0.65rem] font-bold tracking-wider uppercase">Address</div>
                  <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-[0.68rem] font-mono text-slate-600 break-all leading-normal select-all">
                      {publicKey}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                      title="Copy public key"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Details list */}
                <div className="divide-y divide-slate-100 border-t border-b border-slate-100 py-1">
                  <div className="flex items-center justify-between py-2 text-[0.75rem]">
                    <span className="text-slate-400 font-medium">Network</span>
                    <span className="text-slate-700 font-semibold font-mono">Stellar Testnet</span>
                  </div>
                  <div className="flex items-center justify-between py-2 text-[0.75rem]">
                    <span className="text-slate-400 font-medium">Wallet Balance</span>
                    <span className="text-slate-700 font-bold font-mono">
                      {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} XLM
                    </span>
                  </div>
                </div>

                {/* Disconnect Action */}
                <button
                  id="topbar-disconnect-wallet-btn"
                  onClick={async () => {
                    await disconnect();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-100 hover:border-red-200 rounded-xl transition-all duration-150 cursor-pointer"
                >
                  <Link2Off className="w-3.5 h-3.5" />
                  Disconnect Wallet
                </button>
              </div>
            </PopoverContent>
          </Popover>
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
