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
  /** Sign a Soroban transaction XDR via the active wallet adapter */
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string }
  ) => Promise<string>;
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection failed.';
      if (message === 'WALLET_SIGN_REJECTED') {
        toast.error('Signature request cancelled. Connect wallet to try again.');
      } else {
        toast.error(message);
      }
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

  // Stable reference — delegates to active adapter for unified error normalization
  const signTransaction = useCallback(
    (xdr: string, opts?: { networkPassphrase?: string; address?: string }) =>
      stellarKitAdapter.signTransaction(xdr, opts),
    []
  );

  return (
    <WalletContext.Provider
      value={{ isConnected, isConnecting, publicKey, balance, network, connect, disconnect, signTransaction }}
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
