// ═══════════════════════════════════════════════════════════
// Hook: useGatewayNodes
//
// Manages the list of gateway nodes and the registration flow.
// Fetches persisted gateway nodes from /api/gateways/register.
//
// Uses a strict RegistryTxState machine instead of loose booleans.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GatewayNode } from '@/core/types';

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
}

// ─── Error Classification ───────────────────────────────

type GatewayRegisterErrorResponse = {
  error?: string;
  details?: string;
  code?: string;
  events?: Array<{
    topics?: unknown[];
  }>;
};

type GatewayRegisterSuccessResponse = {
  success: true;
  txHash: string;
  node: GatewayNode;
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

// ─── Hook ───────────────────────────────────────────────

export function useGatewayNodes(): UseGatewayNodesReturn {
  const [nodes, setNodes] = useState<GatewayNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [txState, setTxState] = useState<RegistryTxState>(IDLE_STATE);

  // Stable ref so addNode can call fetchNodes without a stale closure
  const isMountedRef = useRef(true);

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

  // Fetch nodes on mount and poll every 30 s
  useEffect(() => {
    isMountedRef.current = true;
    fetchNodes(true);

    const interval = setInterval(() => fetchNodes(false), 30000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchNodes]);

  // addNode function to register the gateway stellar address
  const addNode = useCallback(
    async (data: { name: string; address: string; region: string }): Promise<RegistryTxState | void> => {
      setTxState({ status: 'VALIDATING_CLIENT', failureCode: null, failureMessage: null });

      // Client-side duplicate check → STATE_COLLISION
      if (nodes.find((node) => node.address === data.address)) {
        const failState: RegistryTxState = {
          status: 'FAILED',
          failureCode: 'STATE_COLLISION',
          failureMessage: 'This gateway address is already registered locally. Each address can only be whitelisted once.',
        };
        setTxState(failState);
        return failState;
      }

      setTxState({ status: 'BROADCASTING', failureCode: null, failureMessage: null });

      try {
        const res = await fetch('/api/gateways/register', {
          method: 'POST',
          body: JSON.stringify(data),
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

        // Parse receipt to confirm success; node data comes from re-fetch, not this payload.
        const _receipt: GatewayRegisterSuccessResponse = await res.json();

        // Re-fetch from server — guarantees nodes state holds canonical DB rows, not receipt shape.
        await fetchNodes(false);

        setTxState({ status: 'SUCCESS', failureCode: null, failureMessage: null });

        setTimeout(() => {
          setTxState(IDLE_STATE);
        }, 2000);

      } catch (err: any) {
        const failState: RegistryTxState = {
          status: 'FAILED',
          failureCode: 'UNKNOWN',
          failureMessage: err.message || 'An unexpected error occurred',
        };
        setTxState(failState);
        return failState;
      }
    },
    [nodes, fetchNodes]
  );

  // removeNode function to de-whitelist a gateway node on-chain
  const removeNode = useCallback(
    async (address: string): Promise<RegistryTxState | void> => {
      setTxState({ status: 'BROADCASTING', failureCode: null, failureMessage: null });

      try {
        const res = await fetch('/api/gateways/register', {
          method: 'DELETE',
          body: JSON.stringify({ address }),
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

        // Resync from server — guarantees canonical DB state
        await fetchNodes(false);

        setTxState({ status: 'SUCCESS', failureCode: null, failureMessage: null });

        setTimeout(() => {
          setTxState(IDLE_STATE);
        }, 2000);

      } catch (err: any) {
        const failState: RegistryTxState = {
          status: 'FAILED',
          failureCode: 'UNKNOWN',
          failureMessage: err.message || 'An unexpected error occurred',
        };
        setTxState(failState);
        return failState;
      }
    },
    [fetchNodes]
  );

  const resetForm = useCallback(() => {
    setTxState(IDLE_STATE);
  }, []);

  // Derived booleans — backward compatibility for RegisterNodeForm
  const isSubmitting = txState.status === 'VALIDATING_CLIENT' || txState.status === 'BROADCASTING' || txState.status === 'ON_CHAIN_MINING';
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
  };
}
