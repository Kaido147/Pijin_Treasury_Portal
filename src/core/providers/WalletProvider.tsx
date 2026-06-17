// ═══════════════════════════════════════════════════════════
// Pijin Treasury — WalletProvider
//
// Single source of truth for wallet state across the
// dashboard. Instantiated once in DashboardShell.
// All consumers read via useStellarWallet() → useContext.
// ═══════════════════════════════════════════════════════════

'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { getNetwork } from '@stellar/freighter-api';
import { toast } from 'sonner';
import { freighterAdapter } from '@/infrastructure/stellar/wallet';
import type { WalletState } from '@/core/types';

// ─── Context Shape ───────────────────────────────────────

export interface WalletContextValue extends WalletState {
  /** True while connect/disconnect is in-flight */
  isConnecting: boolean;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [network, setNetwork] = useState<'testnet' | 'mainnet'>('testnet');

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      // ── Testnet Gate ──────────────────────────────────
      const networkResult = await getNetwork();

      if (networkResult.error) {
        toast.error('Could not read Freighter network. Ensure the extension is installed.');
        return;
      }

      const networkString = networkResult.network ?? '';

      if (!networkString.toLowerCase().includes('test')) {
        toast.error(
          'Wrong network detected. Switch to Stellar Testnet in Freighter to continue.',
        );
        return;
      }

      // ── Connect ───────────────────────────────────────
      const result = await freighterAdapter.connect();
      setPublicKey(result.publicKey);
      setBalance(result.balance);
      setNetwork('testnet');
      setIsConnected(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection failed.';
      toast.error(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await freighterAdapter.disconnect();
      setPublicKey(null);
      setBalance(0);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{ isConnected, isConnecting, publicKey, balance, network, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ─── Internal hook (used by useStellarWallet) ────────────

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used inside <WalletProvider>');
  return ctx;
}
