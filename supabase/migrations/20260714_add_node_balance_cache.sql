-- ═══════════════════════════════════════════════════════════
-- Migration: Add Balance Cache to nodes Table
--
-- Adds a cached balance column and sync timestamp so the API
-- can serve balances from DB (fast, resilient) instead of
-- calling Horizon on every request (slow, brittle).
--
-- Pattern: CQRS + Stale-While-Revalidate
--   Reads  → DB (immediate, <50ms)
--   Writes → Background worker syncs Horizon → DB every 60s
--
-- Run this in your Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- Add cached XLM balance column (7 decimal precision matches Stellar stroops)
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS balance NUMERIC(20, 7) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() - INTERVAL '10 minutes');

-- Index for efficient status-based lookups used by the sync worker
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);

-- Comment the columns for documentation clarity
COMMENT ON COLUMN nodes.balance IS 'Cached XLM balance. Updated by background sync worker. Do NOT use for financial transactions — always verify on-chain.';
COMMENT ON COLUMN nodes.last_synced_at IS 'Timestamp of last successful Horizon balance sync. Used for Stale-While-Revalidate invalidation.';
