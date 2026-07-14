// ═══════════════════════════════════════════════════════════
// Hook: useGatewayNodes
//
// Manages the list of gateway nodes and the registration flow.
// Fetches persisted gateway nodes from /api/gateways/register.
//
// Client-side wallet signing lifecycle:
//   VALIDATING_CLIENT
//   → BROADCASTING (phase 1 — fetch unsigned XDR from API)
//   → AWAITING_SIGNATURE (Freighter popup)
//   → BROADCASTING (phase 2 — submit signed envelope to RPC)
//   → ON_CHAIN_MINING (poll until confirmed)
//   → PATCH oracle (verify on-chain, sync DB)
//   → SUCCESS
//
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { TransactionBuilder, rpc } from '@stellar/stellar-sdk';
import type { GatewayNode } from '@/core/types';
import { useStellarWallet } from '@/hooks/useStellarWallet';

// ─── Client-side RPC constants ──────────────────────────
const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

// ─── State Machine Types ────────────────────────────────

export type RegistryTxStatus =
  | 'IDLE'
  | 'VALIDATING_CLIENT'
  | 'AWAITING_SIGNATURE'
  | 'BROADCASTING'
  | 'ON_CHAIN_MINING'
  | 'SUCCESS'
  | 'FAILED';

export type RegistryFailureCode =
  | 'RELAYER_UNFUNDED'
  | 'RESOURCE_EXHAUSTION'
  | 'STATE_COLLISION'
  | 'AUTH_FAILED'
  | 'UNKNOWN';

export interface RegistryTxState {
  status: RegistryTxStatus;
  failureCode: RegistryFailureCode | null;
  failureMessage: string | null;

  /**
   * Differentiates the two BROADCASTING phases for UI label differentiation:
   *   1 — "Generating Ledger Blueprint…" (fetching unsigned XDR from API)
   *   2 — "Transmitting Core XDR…"       (submitting signed envelope to Soroban RPC)
   */
  broadcastPhase?: 1 | 2;
}

const IDLE_STATE: RegistryTxState = {
  status: 'IDLE',
  failureCode: null,
  failureMessage: null,
};

// ─── Return Type ────────────────────────────────────────

export interface UseGatewayNodesReturn {
  nodes: GatewayNode[];
  activeNodes: GatewayNode[];
  revokedNodes: GatewayNode[];
  addNode: (data: { name: string; address: string; region: string }) => Promise<RegistryTxState | void>;
  removeNode: (address: string) => Promise<RegistryTxState | void>;
  /** Unified transaction state machine */
  txState: RegistryTxState;
  /** Derived — backward compat for RegisterNodeForm */
  isSubmitting: boolean;
  /** Derived — backward compat for RegisterNodeForm */
  isSuccess: boolean;
  resetForm: () => void;
  isLoading: boolean;
  loadError: string | null;
  /** Derived — backward compat alias for txState.failureMessage */
  submitError: string | null;
  /**
   * Manually trigger a node list refresh.
   * Used by gateway-ops page after a confirmed funding transaction
   * to update balances without waiting for the next 30-second poll.
   */
  fetchNodes: (initialLoad?: boolean) => Promise<void>;
}

// ─── Error Classification ───────────────────────────────

type GatewayRegisterErrorResponse = {
  type?: string;
  error?: string;
  details?: string;
  code?: string;
  events?: Array<{
    topics?: unknown[];
  }>;
};

type GatewayXdrResponse = {
  unsignedXdr: string;
};

const CONTRACT_ERROR_MESSAGES: Record<number, string> = {
  1: 'Already initialized',
  2: 'Unauthorized. The transaction signer is not the contract admin allowed to register gateways.',
  3: 'Invalid amount',
  4: 'Expired voucher',
  5: 'Nonce replayed',
  6: 'Insufficient balance',
  8: 'Math overflow',
  9: 'Gateway is not whitelisted',
};

function getContractErrorCode(errorData: GatewayRegisterErrorResponse): number | null {
  const detailMatch = errorData.details?.match(/Error\(Contract,\s*#(\d+)\)/);
  if (detailMatch) return Number(detailMatch[1]);

  for (const event of errorData.events ?? []) {
    for (const topic of event.topics ?? []) {
      if (
        topic &&
        typeof topic === 'object' &&
        'type' in topic &&
        'code' in topic &&
        (topic as { type?: unknown }).type === 'contract'
      ) {
        return Number((topic as { code: unknown }).code);
      }
    }
  }

  return null;
}

/**
 * Classifies a backend error response into a typed failure code + message.
 * Checks server-provided `code` field first, then falls back to string matching.
 */
function classifyError(
  errorData: GatewayRegisterErrorResponse,
  httpStatus: number,
): { failureCode: RegistryFailureCode; failureMessage: string } {
  // ── Check server-enriched code field ──
  if (errorData.code === 'RELAYER_UNFUNDED' || httpStatus === 503) {
    return {
      failureCode: 'RELAYER_UNFUNDED',
      failureMessage: 'The relayer gas account is unfunded. Contact the system administrator to top up the treasury XLM pool.',
    };
  }

  // ── Resource exhaustion (Soroban budget) ──
  const details = (errorData.details ?? '').toLowerCase();
  if (
    details.includes('budget') ||
    details.includes('exceededlimit') ||
    details.includes('cpu instructions') ||
    details.includes('resource_limit') ||
    errorData.code === 'RESOURCE_EXHAUSTION'
  ) {
    return {
      failureCode: 'RESOURCE_EXHAUSTION',
      failureMessage: 'Transaction exceeded Soroban CPU or memory limits. The contract invocation is too expensive to execute.',
    };
  }

  // ── State collision (contract error code) ──
  const contractCode = getContractErrorCode(errorData);
  if (contractCode === 1) {
    return {
      failureCode: 'STATE_COLLISION',
      failureMessage: 'This gateway address is already registered on-chain. Each address can only be whitelisted once.',
    };
  }

  // ── Auth failures ──
  if (httpStatus === 401) {
    return {
      failureCode: 'AUTH_FAILED',
      failureMessage: errorData.error || 'Authentication failed. Please reconnect your wallet.',
    };
  }

  // ── Contract errors with known codes ──
  if (contractCode !== null) {
    const message = CONTRACT_ERROR_MESSAGES[contractCode] ?? 'Unknown contract error';
    return {
      failureCode: 'UNKNOWN',
      failureMessage: `Contract rejected register_gateway with error #${contractCode}: ${message}`,
    };
  }

  // ── Fallback ──
  return {
    failureCode: 'UNKNOWN',
    failureMessage: errorData.details || errorData.error || 'Failed to register node',
  };
}

// ─── Polling Helper ─────────────────────────────────────
/**
 * Polls server.getTransaction(hash) every intervalMs until SUCCESS or FAILED.
 *
 * Respects an AbortController signal so in-flight polling is cleanly
 * terminated when the dashboard component unmounts mid-transaction.
 */
async function pollUntilConfirmed(
  server: rpc.Server,
  hash: string,
  signal: AbortSignal,
  maxMs = 60000,
  intervalMs = 2000,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new DOMException('Polling aborted', 'AbortError');
    const result = await server.getTransaction(hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return result as rpc.Api.GetSuccessfulTransactionResponse;
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error('Transaction failed on-chain during confirmation polling.');
    }
    // NOT_FOUND — still pending. Wait intervalMs with abort awareness.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, intervalMs);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Polling aborted', 'AbortError'));
      }, { once: true });
    });
  }
  throw new Error('Transaction confirmation timed out after 60 seconds.');
}


// ─── Hook ───────────────────────────────────────────────

export function useGatewayNodes(): UseGatewayNodesReturn {
  const [nodes, setNodes] = useState<GatewayNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [txState, setTxState] = useState<RegistryTxState>(IDLE_STATE);

  // Stable ref so addNode/removeNode can call fetchNodes without stale closure
  const isMountedRef = useRef(true);

  // AbortController for in-flight polling — killed on unmount
  const abortControllerRef = useRef<AbortController | null>(null);

  // Pull wallet public key + adapter-level signTransaction from context
  const { publicKey, signTransaction } = useStellarWallet();

  const fetchNodes = useCallback(async (initialLoad: boolean = false) => {
    try {
      if (initialLoad) {
        setIsLoading(true);
      }
      // Fetch all the nodes (gateways)
      const res = await fetch('/api/gateways/register', { cache: 'no-store' });

      if (res.ok) {
        const data = await res.json();
        if (isMountedRef.current) {
          setNodes(data);
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setLoadError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Mount: fetch nodes + start 30 s poll. Unmount: abort any in-flight signing poll.
  useEffect(() => {
    isMountedRef.current = true;
    fetchNodes(true);

    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchNodes(false);
    }, 30000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      abortControllerRef.current?.abort();
    };
  }, [fetchNodes]);

  // ─── addNode ──────────────────────────────────────────

  const addNode = useCallback(
    async (data: { name: string; address: string; region: string }): Promise<RegistryTxState | void> => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // ── VALIDATING_CLIENT ──
        setTxState({ status: 'VALIDATING_CLIENT', failureCode: null, failureMessage: null });

        if (!publicKey) {
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: 'AUTH_FAILED',
            failureMessage: 'No wallet connected. Please connect your Freighter wallet first.',
          };
          setTxState(failState);
          return failState;
        }

        // Client-side duplicate check — only flag if an *active* node occupies this address.
        // 'inactive' nodes are the re-authorization target and must not be blocked here.
        if (nodes.find((node) => node.address === data.address && node.status !== 'inactive')) {
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: 'STATE_COLLISION',
            failureMessage: 'This gateway address is already registered locally. Each address can only be whitelisted once.',
          };
          setTxState(failState);
          return failState;
        }
        // ── BROADCASTING — Phase 1: Fetch unsigned XDR from API ──
        setTxState({
          status: 'BROADCASTING',
          failureCode: null,
          failureMessage: null,
          broadcastPhase: 1,
        });


        const res = await fetch('/api/gateways/register', {
          method: 'POST',
          body: JSON.stringify({ ...data, walletPublicKey: publicKey }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const errorData: GatewayRegisterErrorResponse = await res.json();
          const classified = classifyError(errorData, res.status);
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: classified.failureCode,
            failureMessage: classified.failureMessage,
          };
          setTxState(failState);
          return failState;
        }

        const { unsignedXdr }: GatewayXdrResponse = await res.json();

        // ── AWAITING_SIGNATURE: Freighter popup ──
        setTxState({ status: 'AWAITING_SIGNATURE', failureCode: null, failureMessage: null });
        let signedXdr: string;
        try {
          signedXdr = await signTransaction(unsignedXdr, {
            networkPassphrase: NETWORK_PASSPHRASE,
            address: publicKey,
          });
        } catch {
          // User rejected or wallet error — graceful failure
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: 'AUTH_FAILED',
            failureMessage: 'Transaction signing was rejected in your wallet.',
          };
          setTxState(failState);
          return failState;
        }
        // ── BROADCASTING — Phase 2: Submit signed envelope to Soroban RPC ──
        setTxState({
          status: 'BROADCASTING',
          failureCode: null,
          failureMessage: null,
          broadcastPhase: 2,
        });
        const server = new rpc.Server(SOROBAN_RPC_URL);
        // sendTransaction accepts base64 XDR string directly
        const submitResult = await server.sendTransaction(
          TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
        );
        if (submitResult.status === 'ERROR') {
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: 'UNKNOWN',
            failureMessage: 'Transaction was rejected by the Soroban network.',
          };
          setTxState(failState);
          return failState;
        }
        // ── ON_CHAIN_MINING: Poll until confirmed ──
        setTxState({ status: 'ON_CHAIN_MINING', failureCode: null, failureMessage: null });
        await pollUntilConfirmed(server, submitResult.hash, abortController.signal);
        // ── PATCH verification oracle: verify on-chain, then sync DB ──
        await fetch('/api/gateways/register', {
          method: 'PATCH',
          body: JSON.stringify({
            txHash: submitResult.hash,
            action: 'register',
            name: data.name,
            region: data.region,
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        // ── SUCCESS ──

        await fetchNodes(false);
        setTxState({ status: 'SUCCESS', failureCode: null, failureMessage: null });

        setTimeout(() => {
          if (isMountedRef.current) setTxState(IDLE_STATE);
        }, 2000);

      } catch (err: unknown) {
        // Silently bail if component unmounted mid-poll
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const failState: RegistryTxState = {
          status: 'FAILED',
          failureCode: 'UNKNOWN',
          failureMessage: err instanceof Error ? err.message : 'An unexpected error occurred',
        };
        if (isMountedRef.current) setTxState(failState);
        return failState;
      }
    },
    [nodes, fetchNodes, publicKey, signTransaction]
  );

  // ─── removeNode ─────────────────────────────────────────

  const removeNode = useCallback(
    async (address: string): Promise<RegistryTxState | void> => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {

        // ── VALIDATING_CLIENT ──
        setTxState({ status: 'VALIDATING_CLIENT', failureCode: null, failureMessage: null });
        if (!publicKey) {
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: 'AUTH_FAILED',
            failureMessage: 'No wallet connected. Please connect your Freighter wallet first.',
          };
          setTxState(failState);
          return failState;
        }
        // ── BROADCASTING — Phase 1: Fetch unsigned XDR ──
        setTxState({
          status: 'BROADCASTING',
          failureCode: null,
          failureMessage: null,
          broadcastPhase: 1,
        });


        const res = await fetch('/api/gateways/register', {
          method: 'DELETE',
          body: JSON.stringify({ address, walletPublicKey: publicKey }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const errorData: GatewayRegisterErrorResponse = await res.json();
          const classified = classifyError(errorData, res.status);
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: classified.failureCode,
            failureMessage: classified.failureMessage,
          };
          setTxState(failState);
          return failState;
        }

        const { unsignedXdr }: GatewayXdrResponse = await res.json();
        // ── AWAITING_SIGNATURE ──
        setTxState({ status: 'AWAITING_SIGNATURE', failureCode: null, failureMessage: null });
        let signedXdr: string;
        try {
          signedXdr = await signTransaction(unsignedXdr, {
            networkPassphrase: NETWORK_PASSPHRASE,
            address: publicKey,
          });
        } catch {
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: 'AUTH_FAILED',
            failureMessage: 'Transaction signing was rejected in your wallet.',
          };
          setTxState(failState);
          return failState;
        }
        // ── BROADCASTING — Phase 2: Submit signed envelope ──
        setTxState({
          status: 'BROADCASTING',
          failureCode: null,
          failureMessage: null,
          broadcastPhase: 2,
        });
        const server = new rpc.Server(SOROBAN_RPC_URL);
        const submitResult = await server.sendTransaction(
          TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
        );
        if (submitResult.status === 'ERROR') {
          const failState: RegistryTxState = {
            status: 'FAILED',
            failureCode: 'UNKNOWN',
            failureMessage: 'Transaction was rejected by the Soroban network.',
          };
          setTxState(failState);
          return failState;
        }
        // ── ON_CHAIN_MINING ──
        setTxState({ status: 'ON_CHAIN_MINING', failureCode: null, failureMessage: null });
        await pollUntilConfirmed(server, submitResult.hash, abortController.signal);
        // ── PATCH oracle: verify on-chain, sync DB to inactive ──
        await fetch('/api/gateways/register', {
          method: 'PATCH',
          body: JSON.stringify({
            txHash: submitResult.hash,
            action: 'remove',
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        // ── SUCCESS ──

        await fetchNodes(false);

        setTxState({ status: 'SUCCESS', failureCode: null, failureMessage: null });

        setTimeout(() => {
          if (isMountedRef.current) setTxState(IDLE_STATE);
        }, 2000);

      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const failState: RegistryTxState = {
          status: 'FAILED',
          failureCode: 'UNKNOWN',
          failureMessage: err instanceof Error ? err.message : 'An unexpected error occurred',
        };
        if (isMountedRef.current) setTxState(failState);
        return failState;
      }
    },
    [fetchNodes, publicKey, signTransaction]
  );

  const resetForm = useCallback(() => {
    setTxState(IDLE_STATE);
  }, []);

  // Derived booleans — backward compatibility for RegisterNodeForm
  const isSubmitting =
    txState.status === 'VALIDATING_CLIENT' ||
    txState.status === 'AWAITING_SIGNATURE' ||
    txState.status === 'BROADCASTING' ||
    txState.status === 'ON_CHAIN_MINING';
  const isSuccess = txState.status === 'SUCCESS';
  const submitError = txState.failureMessage;

  // Derived arrays — segmented tab support
  const activeNodes = nodes.filter(n => n.status === 'active' || n.status === 'syncing');
  const revokedNodes = nodes.filter(n => n.status === 'inactive');

  return {
    nodes,
    activeNodes,
    revokedNodes,
    addNode,
    removeNode,
    txState,
    isSubmitting,
    isSuccess,
    resetForm,
    isLoading,
    loadError,
    submitError,
    fetchNodes,
  };
}
