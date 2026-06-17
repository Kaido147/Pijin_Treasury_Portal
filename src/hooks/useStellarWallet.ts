// ═══════════════════════════════════════════════════════════
// Hook: useStellarWallet
//
// Bridges the UI to the Stellar wallet adapter layer.
// Currently uses the mock adapter — swap to freighterAdapter
// for production by changing the single import below.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import type { WalletState } from '@/core/types';
import { mockWalletAdapter } from '@/infrastructure/stellar/wallet';

export interface UseStellarWalletReturn extends WalletState {
  /** True while the connect/disconnect operation is in-flight */
  isConnecting: boolean;
}

/**
 * Provides wallet connection state and actions.
 *
 * Usage:
 * ```tsx
 * const { isConnected, publicKey, balance, connect, disconnect, isConnecting } = useStellarWallet();
 * ```
 *
 * When replacing mock with real Freighter:
 * - Change `mockWalletAdapter` → `freighterAdapter` in the import
 * - No component changes required
 */
export function useStellarWallet(): UseStellarWalletReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

  const connect = useCallback(() => {
    setIsConnecting(true);
    mockWalletAdapter
      .connect()
      .then((result) => {
        setPublicKey(result.publicKey);
        setBalance(result.balance);
        setIsConnected(true);
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, []);

  const disconnect = useCallback(() => {
    setIsConnecting(true);
    mockWalletAdapter
      .disconnect()
      .then(() => {
        setPublicKey(null);
        setBalance(0);
        setIsConnected(false);
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, []);

  return {
    isConnected,
    isConnecting,
    publicKey,
    balance,
    network: 'testnet',
    connect,
    disconnect,
  };
}
