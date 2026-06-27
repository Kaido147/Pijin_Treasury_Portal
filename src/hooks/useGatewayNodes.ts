// ═══════════════════════════════════════════════════════════
// Hook: useGatewayNodes
//
// Manages the list of gateway nodes and the registration flow.
// Consumes mock data from the infrastructure layer.
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import type { GatewayNode, RegionCode } from '@/core/types';
import { getMockGatewayNodes } from '@/infrastructure/api/mockData';

export interface UseGatewayNodesReturn {
  /** Current list of gateway nodes */
  nodes: GatewayNode[];
  /** Register a new node (simulated with delay) */
  addNode: (data: { name: string; address: string; region: RegionCode }) => void;
  /** True while a registration request is in-flight */
  isSubmitting: boolean;
  /** True for 2s after a successful registration */
  isSuccess: boolean;
  /** Reset the form state back to idle */
  resetForm: () => void;
}

/**
 * Provides gateway node data and registration actions.
 *
 * Usage:
 * ```tsx
 * const { nodes, addNode, isSubmitting, isSuccess, resetForm } = useGatewayNodes();
 * ```
 *
 * When replacing mock with real API:
 * - Swap `getMockGatewayNodes()` with a fetch call
 * - Swap the `setTimeout` in `addNode` with a POST request
 * - No component changes required
 */
export function useGatewayNodes(): UseGatewayNodesReturn {
  const [nodes, setNodes] = useState<GatewayNode[]>(() => getMockGatewayNodes());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const addNode = useCallback(
    (data: { name: string; address: string; region: RegionCode }) => {
      setIsSubmitting(true);

      // Simulate network delay for node registration
      setTimeout(() => {
        const newNode: GatewayNode = {
          id: `node-${String(nodes.length + 1).padStart(3, '0')}`,
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

        // Auto-dismiss success state after 2s
        setTimeout(() => {
          setIsSuccess(false);
        }, 2000);
      }, 1800);
    },
    [nodes.length],
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
  };
}
