// ═══════════════════════════════════════════════════════════
// Hook: useGatewayNodes
//
// Manages the list of gateway nodes and the registration flow.
// Fetches persisted gateway nodes from /api/gateways/register.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect } from 'react';
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
  const { isConnected } = useStellarWallet();
  const [nodes, setNodes] = useState<GatewayNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch nodes on mount and optionally poll
  useEffect(() => {
    let isMounted = true;

    async function fetchNodes(initialLoad: boolean = false) {
      try {
        if (initialLoad) {
          setIsLoading(true);
        }
        // Fetch all the nodes (gateways)
        const res = await fetch('/api/gateways/register', { cache: 'no-store' });

        if (res.status === 401) {
          setNodes([]); // Wipe the data if not authenticated
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setNodes(data);
          }
        }
      } catch (err) {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (!isConnected) {
      setNodes([]);
      setIsLoading(false);
      return;
    }

    fetchNodes(true);

    // Poll every 30 seconds without toggling the loading spinner
    const interval = setInterval(() => fetchNodes(false), 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isConnected]);

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

        const result: GatewayRegisterSuccessResponse = await res.json();

        setTimeout(() => {
          setNodes((prev) => [...prev, result.node]);
          setIsSubmitting(false);
          setIsSuccess(true);

          setTimeout(() => {
            setIsSuccess(false);
          }, 2000);
        }, 1000);

      } catch (err: any) {
        setSubmitError(err.message);
        setIsSubmitting(false); // this unlocks the form if it fails
      }
    },
    [nodes] // added nodes here so it always has the latest list
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
