// ═══════════════════════════════════════════════════════════
// Hook: useGatewayNodes
//
// Manages the list of gateway nodes and the registration flow.
// Fetches persisted gateway nodes from /api/gateways/register.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GatewayNode } from '@/core/types';
import { useStellarWallet } from '@/hooks/useStellarWallet';

export interface UseGatewayNodesReturn {
  nodes: GatewayNode[];
  addNode: (data: { name: string; address: string; region: string }) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  resetForm: () => void;
  isLoading: boolean;
  loadError: string | null;
  submitError: string | null;
}

type GatewayRegisterErrorResponse = {
  error?: string;
  details?: string;
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

function formatRegisterError(errorData: GatewayRegisterErrorResponse): string {
  const code = getContractErrorCode(errorData);

  if (code !== null) {
    const message = CONTRACT_ERROR_MESSAGES[code] ?? 'Unknown contract error';
    return `Contract rejected register_gateway with error #${code}: ${message}`;
  }

  return errorData.details || errorData.error || 'Failed to register node';
}

export function useGatewayNodes(): UseGatewayNodesReturn {
  const [nodes, setNodes] = useState<GatewayNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
    async (data: { name: string; address: string; region: string }) => {
      setIsSubmitting(true);
      setSubmitError(null);

      if (nodes.find((node) => node.address === data.address)) {
        setSubmitError('Node already exists');
        setIsSubmitting(false);
        return;
      }

      try {
        const res = await fetch('/api/gateways/register', {
          method: 'POST',
          body: JSON.stringify(data),
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const errorData: GatewayRegisterErrorResponse = await res.json();
          throw new Error(formatRegisterError(errorData));
        }

        // Parse receipt to confirm success; node data comes from re-fetch, not this payload.
        const _receipt: GatewayRegisterSuccessResponse = await res.json();

        // Re-fetch from server — guarantees nodes state holds canonical DB rows, not receipt shape.
        await fetchNodes(false);

        setIsSubmitting(false);
        setIsSuccess(true);

        setTimeout(() => {
          setIsSuccess(false);
        }, 2000);

      } catch (err: any) {
        setSubmitError(err.message);
        setIsSubmitting(false); // this unlocks the form if it fails
      }
    },
    [nodes, fetchNodes]
  );

  const resetForm = useCallback(() => {
    setIsSubmitting(false);
    setIsSuccess(false);
  }, []);

  return {
    nodes,
    addNode,
    isSubmitting,
    isSuccess,
    resetForm,
    isLoading,
    loadError,
    submitError
  };
}
