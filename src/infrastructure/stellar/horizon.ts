// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Stellar Horizon API
//
// Utility functions for interacting with the Stellar Horizon
// network directly via REST API.
// ═══════════════════════════════════════════════════════════

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";

import type { Transaction, TxType, TxStatus } from '@/core/types';

/**
 * Helper to map a raw Horizon transaction and its operations into our domain Transaction.
 * It fetches the operations for the transaction to determine the amount and destination.
 */
async function mapHorizonTxToDomain(rawTx: any, accountId: string): Promise<Transaction> {
  const isSuccessful = rawTx.successful;
  const status: TxStatus = isSuccessful ? 'confirmed' : 'failed';

  let type: TxType = 'credit';
  let amount = '0.00';
  let from = rawTx.source_account;
  let to = 'Unknown';
  let memo = rawTx.memo || '';

  try {
    // Fetch operations to find the actual amount/to/from
    const opsRes = await fetch(`${rawTx._links.operations.href}`);
    if (opsRes.ok) {
      const opsData = await opsRes.json();
      const records = opsData._embedded?.records || [];

      // Look for a payment or path_payment operation
      const paymentOp = records.find((op: any) =>
        op.type === 'payment' || op.type === 'path_payment_strict_receive' || op.type === 'path_payment_strict_send'
      );

      if (paymentOp) {
        from = paymentOp.from || paymentOp.source_account;
        to = paymentOp.to;
        amount = paymentOp.amount;
        type = from === accountId ? 'debit' : 'credit';
      } else {
        // If no payment op, just determine if it was our tx
        type = rawTx.source_account === accountId ? 'debit' : 'credit';
      }
    }
  } catch (error) {
    console.warn('Failed to fetch operations for tx', rawTx.hash);
  }

  return {
    id: rawTx.id,
    hash: rawTx.hash,
    type,
    amount,
    from,
    to,
    memo,
    status,
    ts: new Date(rawTx.created_at),
  };
}

/**
 * Fetches the live XLM balance for a given Stellar public key.
 * 
 * @param publicKey The Stellar public key to check.
 * @returns The XLM balance as a string, or '0.00' if it cannot be retrieved.
 */
export async function fetchStellarBalance(publicKey: string, signal?: AbortSignal): Promise<string> {
  if (!publicKey) return '0.00';

  try {
    const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}`, {
      signal,
      // Ensure we don't cache this heavily on the server if we want live data
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch balance for ${publicKey}: ${response.statusText}`);
      return '0.00'; // Return '0.00' for unfunded or invalid accounts
    }

    const data = await response.json();

    // Find the native XLM balance
    const nativeBalance = data.balances?.find(
      (b: any) => b.asset_type === 'native'
    );

    if (nativeBalance && nativeBalance.balance) {
      // Format to 2 decimal places if needed, but Stellar returns a string like "123.4567890"
      const balanceNum = parseFloat(nativeBalance.balance);
      return balanceNum.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return '0.00';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error(`Error fetching balance for ${publicKey}:`, error);
    return '0.00';
  }
}

/**
 * Fetches the most recent transactions for a given account.
 */
export async function fetchRecentTransactions(accountId: string, limit = 20): Promise<Transaction[]> {
  if (!accountId) return [];

  try {
    const response = await fetch(`${HORIZON_URL}/accounts/${accountId}/transactions?order=desc&limit=${limit}`);
    if (!response.ok) return [];

    const data = await response.json();
    const records = data._embedded?.records || [];

    const transactions = await Promise.all(
      records.map((record: any) => mapHorizonTxToDomain(record, accountId))
    );

    return transactions;
  } catch (error) {
    console.error(`Error fetching transactions for ${accountId}:`, error);
    return [];
  }
}

/**
 * Subscribes to real-time transactions for a given account via Server-Sent Events (SSE).
 * Returns a function to close the connection.
 */
export function subscribeToTransactions(
  accountId: string,
  onMessage: (tx: Transaction) => void,
  onError: (err: any) => void
): () => void {
  if (!accountId) return () => { };

  const es = new EventSource(`${HORIZON_URL}/accounts/${accountId}/transactions?cursor=now`);

  es.onmessage = async (event) => {
    try {
      const rawTx = JSON.parse(event.data);
      const tx = await mapHorizonTxToDomain(rawTx, accountId);
      onMessage(tx);
    } catch (err) {
      console.error('Error parsing streaming transaction', err);
    }
  };

  es.onerror = (err) => {
    console.error('SSE Error', err);
    onError(err);
  };

  return () => {
    es.close();
  };
}

