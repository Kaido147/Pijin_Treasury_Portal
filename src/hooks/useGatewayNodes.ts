// ═══════════════════════════════════════════════════════════
// Hook: useGatewayNodes
//
// Manages the list of gateway nodes and the registration flow.
// Fetches live status from /api/gateways/health (server config + Horizon).
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { GatewayNode } from '@/core/types';

export interface UseGatewayNodesReturn {
  nodes: GatewayNode[];
  addNode: (data: { name: string; address: string; region: string }) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  resetForm: () => void;
  isLoading: boolean;
  error: string | null;
}

export function useGatewayNodes(): UseGatewayNodesReturn {
  const [nodes, setNodes] = useState<GatewayNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        const res = await fetch('/api/gateways/health', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch gateway nodes');

        const data: GatewayNode[] = await res.json();
        if (isMounted) {
          setNodes(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchNodes(true);

    // Poll every 30 seconds without toggling the loading spinner
    const interval = setInterval(() => fetchNodes(false), 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const addNode = useCallback(
    async (data: { name: string; address: string; region: string }) => {
      setIsSubmitting(true);

      if (nodes.find((node) => node.address === data.address)) {
        setError('Node already exists');
        setIsSubmitting(false);
        return;
      }

      const res = await fetch('/api/gateways/register', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to register node');
      }

      setTimeout(() => {
        const newNode: GatewayNode = {
          id: `node-${Date.now()}`,
          name: data.name,
          address: data.address,
          region: data.region,
          status: 'syncing',
          uptime: '—',
          balance: '0.00',
        };

        setNodes((prev) => [...prev, newNode]);
        setIsSubmitting(false);
        setIsSuccess(true);

        setTimeout(() => {
          setIsSuccess(false);
        }, 2000);
      }, 1000);
    },
    []
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
    error
  };
}
