// ═══════════════════════════════════════════════════════════
// Hook: useStellarWallet
//
// Thin wrapper over WalletContext. Returns the shared
// global wallet state instantiated by WalletProvider.
// All consumers (Topbar, WalletBalanceCard, pages) remain
// unchanged — hook return type is identical.
// ═══════════════════════════════════════════════════════════

'use client';

import { useWalletContext, type WalletContextValue } from '@/core/providers/WalletProvider';

export type UseStellarWalletReturn = WalletContextValue;

export function useStellarWallet(): UseStellarWalletReturn {
  return useWalletContext();
}
