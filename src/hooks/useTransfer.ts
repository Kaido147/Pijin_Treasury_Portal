// ═══════════════════════════════════════════════════════════
// Hook: useTransfer
//
// Manages the XLM treasury funding lifecycle.
// Calls POST /api/treasury/fund — server hot-wallet signs and
// broadcasts. PIN is passed per-request (Web2.5 pattern).
//
// On-chain confirmation polling (Option B):
//   After the POST returns a txHash, this hook polls the
//   Soroban RPC every 1.5s until the ledger confirms the
//   transaction (SUCCESS) or rejects it (FAILED).
//   Only then does formState transition to 'success' or 'error'.
//
//   This guarantees the onConfirmed callback (used by the page
//   to refetch node balances) fires only after the transaction
//   is fully committed — no race conditions, no stale data.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { rpc } from '@stellar/stellar-sdk';
import type { TransferFormState } from '@/core/types';

// ─── RPC configuration (client-safe env var) ────────────
const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

/** Maximum time to wait for ledger confirmation before giving up (30 seconds) */
const POLL_TIMEOUT_MS = 30_000;
/** How frequently to check the transaction status */
const POLL_INTERVAL_MS = 1_500;

// ─── Polling helper ─────────────────────────────────────

/**
 * Polls Soroban RPC for the status of a submitted transaction hash.
 *
 * Resolves when status is SUCCESS.
 * Rejects if status is FAILED, or if POLL_TIMEOUT_MS is exceeded.
 */
async function waitForConfirmation(txHash: string): Promise<void> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const result = await server.getTransaction(txHash);

    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return; // Confirmed on-chain ✓
    }

    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction was rejected by the Stellar network.');
    }

    // NOT_FOUND — still pending, wait and retry
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    'Transaction confirmation timed out after 30 seconds. The network may be congested. Check the transaction hash manually.'
  );
}

export interface UseTransferReturn {
  /** Current form lifecycle state */
  formState: TransferFormState;
  /** Transaction hash (populated after broadcast, before confirmation) */
  txHash: string;
  /**
   * Submit a treasury transfer.
   *
   * Phase 1: POST /api/treasury/fund (PIN verification + broadcast) ~1s
   * Phase 2: Poll Soroban RPC until ledger confirms (~3-5s)
   * Phase 3: Call onConfirmed() callback, then set formState = 'success'
   *
   * Throws on API or network error — caller (PinConfirmDialog.onConfirm)
   * catches and displays the error message.
   */
  submitTransfer: (data: {
    address: string;
    amount: string;
    memo: string;
    pin: string;
    /** Optional: called immediately after on-chain confirmation, before success state */
    onConfirmed?: () => void;
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
    async (data: {
      address: string;
      amount: string;
      memo: string;
      pin: string;
      onConfirmed?: () => void;
    }): Promise<void> => {
      setFormState('submitting');
      setTransferError(null);

      try {
        // ── Phase 1: POST to treasury fund API ──
        // Server verifies PIN, builds + signs + broadcasts transaction.
        // Returns txHash of the pending transaction.
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
        // Surface the txHash immediately — UI can show "Confirming on ledger..."
        setTxHash(hash);

        // ── Phase 2: Poll Soroban RPC until ledger confirms ──
        // Stays in 'submitting' state so the dialog shows a "Confirming..." label.
        // waitForConfirmation resolves only on SUCCESS, throws on FAILED or timeout.
        await waitForConfirmation(hash);

        // ── Phase 3: Fire onConfirmed callback, then mark success ──
        // onConfirmed triggers fetchNodes() in the page so the balance
        // updates in the dashboard before the dialog transitions to green.
        data.onConfirmed?.();
        setFormState('success');

      } catch (err) {
        // Re-throw if already an Error (from the !res.ok or polling failure)
        if (err instanceof Error) {
          setTransferError(err.message);
          setFormState('idle');
          throw err;
        }
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
