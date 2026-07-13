// ═══════════════════════════════════════════════════════════
// Hook: useTransfer
//
// Manages the XLM treasury funding lifecycle.
// Calls POST /api/treasury/fund — server hot-wallet signs and
// broadcasts. PIN is passed per-request (Web2.5 pattern).
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import type { TransferFormState } from '@/core/types';

export interface UseTransferReturn {
  /** Current form lifecycle state */
  formState: TransferFormState;
  /** Transaction hash (populated after success) */
  txHash: string;
  /**
   * Submit a treasury transfer.
   *
   * Calls POST /api/treasury/fund with { destination, amount, memo, pin }.
   * Throws on API or network error — caller (PinConfirmDialog.onConfirm)
   * catches and displays the error message.
   */
  submitTransfer: (data: {
    address: string;
    amount: string;
    memo: string;
    pin: string;
  }) => Promise<void>;
  /** Reset form back to idle state */
  resetTransfer: () => void;
  /** Last transfer error message, or null */
  transferError: string | null;
}

export function useTransfer(): UseTransferReturn {
  const [formState, setFormState] = useState<TransferFormState>('idle');
  const [txHash, setTxHash] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  const submitTransfer = useCallback(
    async (data: { address: string; amount: string; memo: string; pin: string }): Promise<void> => {
      setFormState('submitting');
      setTransferError(null);

      try {
        const res = await fetch('/api/treasury/fund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination: data.address,
            amount: data.amount,
            memo: data.memo || undefined,
            pin: data.pin,
          }),
        });

        if (!res.ok) {
          const err = await res.json() as { error?: string };
          const message = err.error ?? 'Transfer failed. Please try again.';
          setTransferError(message);
          setFormState('idle');
          // Throw so PinConfirmDialog.onConfirm shows the error inline
          throw new Error(message);
        }

        const { txHash: hash } = await res.json() as { txHash: string };
        setTxHash(hash);
        setFormState('success');
      } catch (err) {
        // Re-throw if already an Error (from the !res.ok branch above)
        if (err instanceof Error) throw err;
        const message = 'Unexpected error during transfer.';
        setTransferError(message);
        setFormState('idle');
        throw new Error(message);
      }
    },
    [],
  );

  const resetTransfer = useCallback(() => {
    setFormState('idle');
    setTxHash('');
    setTransferError(null);
  }, []);

  return { formState, txHash, submitTransfer, resetTransfer, transferError };
}
