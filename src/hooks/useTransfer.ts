// ═══════════════════════════════════════════════════════════
// Hook: useTransfer
//
// Manages the XLM transfer form submission lifecycle.
// Simulates a Stellar transaction broadcast with delay.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import type { TransferFormState } from '@/core/types';
import { generateHash } from '@/core/utils';

export interface UseTransferReturn {
  /** Current form lifecycle state */
  formState: TransferFormState;
  /** Transaction hash (populated after success) */
  txHash: string;
  /** Submit a transfer — returns void, updates formState internally */
  submitTransfer: (data: {
    address: string;
    amount: string;
    memo: string;
  }) => void;
  /** Reset form back to idle state */
  resetTransfer: () => void;
}

/**
 * Manages the transfer form submission lifecycle.
 *
 * When replacing mock with real Stellar:
 * - Swap the setTimeout with a call to the wallet adapter's
 *   signAndSubmit method via the Soroban RPC client
 * - No component changes required
 */
export function useTransfer(): UseTransferReturn {
  const [formState, setFormState] = useState<TransferFormState>('idle');
  const [txHash, setTxHash] = useState('');

  const submitTransfer = useCallback(
    (_data: { address: string; amount: string; memo: string }) => {
      setFormState('submitting');

      // Simulate signing + broadcasting delay
      setTimeout(() => {
        const hash = generateHash();
        setTxHash(hash);
        setFormState('success');
      }, 2200);
    },
    [],
  );

  const resetTransfer = useCallback(() => {
    setFormState('idle');
    setTxHash('');
  }, []);

  return { formState, txHash, submitTransfer, resetTransfer };
}
