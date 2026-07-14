// ═══════════════════════════════════════════════════════════
// Balance Sync Service — CQRS Write Side
//
// Responsible for fetching live XLM balances from Stellar
// Horizon and writing them back to the nodes table.
//
// Architecture: Stale-While-Revalidate (SWR)
//   - GET /api/gateways/register reads from DB instantly
//   - If any node's last_synced_at is > STALE_THRESHOLD_MS,
//     this service is called as a fire-and-forget background
//     task to refresh the cache without blocking the response
//
// Called from:
//   1. GET handler (background, if cache is stale)
//   2. PATCH handler (immediate, after new node registration)
//
// ═══════════════════════════════════════════════════════════

import { fetchStellarBalance } from '@/infrastructure/stellar/horizon';
import { createServiceClient } from '@/infrastructure/supabase/server';

/** Re-sync balance if older than this threshold (60 seconds) */
export const BALANCE_STALE_THRESHOLD_MS = 60_000;

/** Per-node Horizon fetch timeout to prevent hanging the sync (4 seconds) */
const HORIZON_FETCH_TIMEOUT_MS = 4_000;

type SyncableNode = {
  id: string;
  stellar_address: string;
  last_synced_at: string | null;
};

/**
 * Determines if a node's cached balance is considered stale and needs refresh.
 */
export function isBalanceStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() > BALANCE_STALE_THRESHOLD_MS;
}

/**
 * Syncs the XLM balance for a single node address.
 * Writes result back to DB. Silently handles failures.
 *
 * @param nodeId     The DB row UUID
 * @param address    The Stellar public key to query
 */
async function syncSingleNodeBalance(nodeId: string, address: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HORIZON_FETCH_TIMEOUT_MS);

  try {
    const balance = await fetchStellarBalance(address, controller.signal);

    // Parse to numeric for DB storage (strip locale formatting like commas)
    const numericBalance = parseFloat(balance.replace(/,/g, '')) || 0;

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('nodes')
      .update({
        balance: numericBalance,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', nodeId);

    if (error) {
      console.error(`[BalanceSync] DB write failed for node ${nodeId}:`, error.message);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn(`[BalanceSync] Horizon timeout for node ${nodeId} (${address})`);
      return;
    }
    console.error(`[BalanceSync] Unexpected error for node ${nodeId}:`, err);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Syncs balances for all provided stale nodes concurrently.
 * This is always called as a fire-and-forget — the caller does NOT await it.
 *
 * Concurrency is bounded by Promise.all across the node list.
 * For very large node sets (100+), consider chunking.
 *
 * @param nodes  Nodes whose balances need refreshing
 */
export async function syncNodeBalances(nodes: SyncableNode[]): Promise<void> {
  if (!nodes.length) return;

  console.log(`[BalanceSync] Starting sync for ${nodes.length} node(s)...`);

  await Promise.all(
    nodes.map((node) => syncSingleNodeBalance(node.id, node.stellar_address))
  );

  console.log(`[BalanceSync] Sync complete for ${nodes.length} node(s).`);
}

/**
 * Triggers an immediate balance sync for a single node.
 * Used by the PATCH verification oracle after a new node is registered.
 *
 * Fire-and-forget — do not await in the PATCH handler.
 *
 * @param nodeId   The DB UUID of the newly registered node
 * @param address  The gateway's Stellar public key
 */
export function triggerImmediateBalanceSync(nodeId: string, address: string): void {
  // Intentionally not awaited — runs in background
  syncSingleNodeBalance(nodeId, address).catch((err) => {
    console.error('[BalanceSync] Immediate sync failed:', err);
  });
}
