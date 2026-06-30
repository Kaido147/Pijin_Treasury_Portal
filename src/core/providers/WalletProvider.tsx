// ═══════════════════════════════════════════════════════════
// Pijin Treasury — WalletProvider
//
// Single source of truth for wallet state across the
// dashboard. Instantiated once in DashboardShell.
// All consumers read via useStellarWallet() → useContext.
// ═══════════════════════════════════════════════════════════

'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { toast } from 'sonner';
import { stellarKitAdapter } from '@/infrastructure/stellar/wallet';
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
      // ── Connect ───────────────────────────────────────
      const result = await stellarKitAdapter.connect();

      // Auth Challenge - POST Request
      const challengeRes = await fetch(`/api/auth/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminAddress: result.publicKey }),
      });
      if (!challengeRes.ok) {
        let errMessage = 'Failed to fetch auth challenge';
        try {
          const errData = await challengeRes.json();
          if (errData.error) errMessage = errData.error;
        } catch (e) { }
        throw new Error(errMessage);
      }
      const { nonce } = await challengeRes.json();

      // Sign the nonce with the wallet
      const signature = await stellarKitAdapter.signMessage(nonce);

      // Verify the signature to get the JWT cookie
      const verifyRes = await fetch(`/api/auth/challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminAddress: result.publicKey,
          nonce,
          signature
        }),
      });

      if (!verifyRes.ok) {
        let errMessage = 'Failed to verify auth challenge';
        try {
          const errData = await verifyRes.json();
          if (errData.error) errMessage = errData.error;
        } catch (e) { }
        throw new Error(errMessage);
      }

      setPublicKey(result.publicKey);
      setBalance(result.balance);
      setNetwork('testnet');
      setIsConnected(true);
    } catch (err: any) {
      // Catch the declined signing error message
      const rawError = err?.message || err?.toString() || '';
      const lowerError = rawError.toLowerCase();

      const isRejected = lowerError.includes('reject') ||
        lowerError.includes('decline') ||
        lowerError.includes('cancel');

      let finalMessage = 'Wallet Connection Failed';

      if (isRejected) {
        finalMessage = 'Action canceled by user.';
      } else if (err instanceof Error) {
        finalMessage = err.message;
      } else if (typeof err === 'string' && err.trim() !== '') {
        finalMessage = err;
      }

      toast.error(finalMessage);
      setPublicKey(null);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await stellarKitAdapter.disconnect();
      setPublicKey(null);
      setBalance(0);
      setIsConnected(false);
      localStorage.removeItem('admin_session');
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => { }); // Automatically signs out when the sign message is decline
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
