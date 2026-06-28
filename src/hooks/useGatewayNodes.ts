// ═══════════════════════════════════════════════════════════
// Hook: useGatewayNodes
//
// Manages the list of gateway nodes and the registration flow.
// Fetches live status from /api/gateways/health (server config + Horizon).
// ═══════════════════════════════════════════════════════════

'use client';

<<<<<<< HEAD
import { useState, useCallback, useEffect } from 'react';
import type { GatewayNode } from '@/core/types';
=======
import { useState, useCallback } from 'react';
import type { GatewayNode, RegionCode } from '@/core/types';
import { getMockGatewayNodes } from '@/infrastructure/api/mockData';
>>>>>>> 3fda6019916b97512da6eab4a3cc11c8bf32eee4

export interface UseGatewayNodesReturn {
  nodes: GatewayNode[];
<<<<<<< HEAD
  addNode: (data: { name: string; address: string; region: string }) => void;
=======
  /** Register a new node (simulated with delay) */
  addNode: (data: { name: string; address: string; region: RegionCode }) => void;
  /** True while a registration request is in-flight */
>>>>>>> 3fda6019916b97512da6eab4a3cc11c8bf32eee4
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

<<<<<<< HEAD
  // Fetch nodes on mount and optionally poll
  useEffect(() => {
    let isMounted = true;
=======
  const addNode = useCallback(
    (data: { name: string; address: string; region: RegionCode }) => {
      setIsSubmitting(true);
>>>>>>> 3fda6019916b97512da6eab4a3cc11c8bf32eee4

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
      
      // Note: If you want to persist custom user-added nodes, you would add a POST
      // to /api/gateways/health (or another route) here and save it to a DB.
      // For now, we simulate adding it to local state so the UI still works.
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
