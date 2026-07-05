import type { WalletInfo } from '@/core/types';
import { truncateAddress } from '@/core/utils';

interface WalletBalanceCardProps {
  walletInfo: WalletInfo;
  isConnected: boolean;
}

export function WalletBalanceCard({
  walletInfo,
  isConnected,
}: WalletBalanceCardProps) {
  return (
    <div className="rounded-3xl overflow-hidden relative bg-gradient-to-br from-navy-900 via-navy-700 to-blue-700 shadow-hero">
      {/* Decorative orbs */}
      <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full opacity-10 bg-[radial-gradient(circle,#93c5fd,transparent)]" />
      <div className="absolute bottom-0 -left-8 w-40 h-40 rounded-full opacity-10 bg-[radial-gradient(circle,#60a5fa,transparent)]" />

      <div className="relative px-5 py-6 lg:px-8 lg:pt-8 lg:pb-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="text-white/50 text-[0.7rem] font-bold tracking-widest uppercase mb-1">
              Admin Wallet · Stellar Testnet
            </div>
            <div className="text-white/45 text-[0.68rem] font-mono tracking-[0.04em]">
              {truncateAddress(walletInfo.address, 14, 8)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/70 text-[0.7rem] font-semibold">
              {isConnected ? 'Connected' : 'Testnet'}
            </span>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-6">
          <div className="font-mono font-bold text-5xl text-white leading-none tracking-tight">
            {walletInfo.balancePhp}
          </div>
          <div className="text-white/40 text-[0.85rem] mt-2">
            {walletInfo.balanceXlm} XLM
          </div>
        </div>

        {/* Stats footer */}
        <div className="pt-4 grid grid-cols-3 gap-2 text-center lg:flex lg:items-center lg:justify-between lg:text-left border-t border-white/10">
          <div>
            <div className="text-white/35 text-[0.68rem]">24h Change</div>
            <div className="text-green-400 font-mono text-[0.9rem] font-medium">
              {walletInfo.change24h}
            </div>
          </div>
          <div>
            <div className="text-white/35 text-[0.68rem]">Funded Nodes</div>
            <div className="text-white/80 font-mono text-[0.9rem] font-medium">
              {walletInfo.fundedNodes}
            </div>
          </div>
          <div>
            <div className="text-white/35 text-[0.68rem]">
              Total Distributed
            </div>
            <div className="text-white/80 font-mono text-[0.9rem] font-medium">
              {walletInfo.totalDistributed}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
