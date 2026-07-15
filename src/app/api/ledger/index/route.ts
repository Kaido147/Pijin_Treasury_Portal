// ═══════════════════════════════════════════════════════════
// Pijin Treasury — BFF API Route: Contract Event Indexer
//
// GET  /api/ledger/index  — called by Vercel cron (every minute)
// POST /api/ledger/index  — called by useContractLedger hook
//                           (fire-and-forget on each poll tick)
//
// Both verbs call runIndexer() which is idempotent:
//   • Reads last cursor from indexer_state
//   • Fetches new events from Stellar RPC
//   • Upserts into contract_events
//   • Saves new cursor
//
// No request auth required — this endpoint only writes public
// on-chain data. Add CRON_SECRET verification before mainnet.
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { runIndexer } from '@/infrastructure/stellar/event-indexer';

async function handleIndex(): Promise<NextResponse> {
  try {
    const result = await runIndexer();
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Indexer error';
    console.error('[api/ledger/index] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel cron invocation — fires GET every minute per vercel.json */
export const GET = handleIndex;

/** Hook invocation — fire-and-forget POST on each poll tick */
export const POST = handleIndex;
