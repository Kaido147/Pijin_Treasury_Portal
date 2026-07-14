// ═══════════════════════════════════════════════════════════
// Pijin Treasury — BFF API Route: Contract Event Ledger
//
// GET /api/ledger/events
//
// Query params:
//   cursor  — opaque Stellar RPC pagination cursor (string)
//             If omitted, fetches from the oldest available ledger.
//   limit   — number of events to return (default: 50, max: 100)
//
// Response: LedgerEventsResponse JSON
//
// CONTRACT_ID is read from server-only env — never exposed to client.
// To change the monitored contract, update CONTRACT_ID in .env.local.
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { rpc } from '@stellar/stellar-sdk';
import { decodeContractEvent } from '@/infrastructure/stellar/event-decoder';
import type { LedgerEventsResponse } from '@/core/types';

// ─── Environment ─────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[api/ledger/events] Missing required environment variable: ${name}`,
    );
  }
  return value;
}

// ─── Constants ───────────────────────────────────────────

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

// ─── Helpers ─────────────────────────────────────────────

/**
 * Extracts oldestLedger from an RPC error response payload.
 * When startLedger < oldestLedger, the RPC error body contains
 * the actual oldestLedger so we can retry from the correct point.
 */
function extractOldestLedgerFromError(err: unknown): number | null {
  try {
    // The SDK wraps RPC errors — the JSON body is in err.response.data or err.message
    const data =
      (err as { response?: { data?: unknown } })?.response?.data ??
      (err as { data?: unknown })?.data;

    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      // Standard JSON-RPC error: { error: { data: { oldestLedger: N } } }
      const oldest =
        (d['error'] as Record<string, unknown>)?.['data'] &&
        typeof (d['error'] as Record<string, unknown>)?.['data'] === 'object'
          ? ((d['error'] as Record<string, unknown>)['data'] as Record<string, unknown>)?.['oldestLedger']
          : null;
      if (typeof oldest === 'number') return oldest;
    }

    // Fallback: parse the error message string
    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/oldestLedger[^\d]*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  } catch {
    // Parsing failure — swallow silently
  }
  return null;
}

/**
 * Calls getEvents, retrying once with oldestLedger if startLedger is too old.
 */
async function fetchEventsWithFallback(
  server: rpc.Server,
  contractId: string,
  limit: number,
): Promise<rpc.Api.GetEventsResponse> {
  // Testnet closes ~1 ledger per 5-6s.
  // 7 days ≈ 120,960 ledgers; 24h ≈ 17,280. We try 200k (>7 days).
  // If the node retains less, we fall back to oldestLedger from the error.
  const info = await server.getLatestLedger();
  const candidateStart = Math.max(1, info.sequence - 200_000);

  const filter: rpc.Api.EventFilter = {
    type: 'contract',
    contractIds: [contractId],
  };

  try {
    return await server.getEvents({
      startLedger: candidateStart,
      filters: [filter],
      limit,
    });
  } catch (firstErr: unknown) {
    console.warn(
      '[api/ledger/events] startLedger too old, attempting fallback:',
      candidateStart,
    );

    // Try to extract the oldest available ledger from the error
    const oldest = extractOldestLedgerFromError(firstErr);

    if (oldest !== null) {
      console.info('[api/ledger/events] Retrying from oldestLedger:', oldest);
      return server.getEvents({
        startLedger: oldest,
        filters: [filter],
        limit,
      });
    }

    // No oldestLedger in error — last resort: use latest - 17280 (24h)
    const conservativeStart = Math.max(1, info.sequence - 17_280);
    console.info(
      '[api/ledger/events] Retrying from conservative 24h start:',
      conservativeStart,
    );
    return server.getEvents({
      startLedger: conservativeStart,
      filters: [filter],
      limit,
    });
  }
}

// ─── Route Handler ───────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // CONTRACT_ID is intentionally NOT prefixed NEXT_PUBLIC_.
    // Change contract = edit .env.local only, zero code changes.
    const contractId = requireEnv('CONTRACT_ID');
    const rpcUrl     = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL
                       ?? 'https://soroban-testnet.stellar.org';

    const { searchParams } = request.nextUrl;
    const cursorParam      = searchParams.get('cursor');
    const limitParam       = searchParams.get('limit');
    const limit            = Math.min(
      Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      MAX_LIMIT,
    );

    const server = new rpc.Server(rpcUrl, { allowHttp: false });

    let rpcResponse: rpc.Api.GetEventsResponse;

    if (cursorParam) {
      // Cursor mode — polling or load-more
      rpcResponse = await server.getEvents({
        cursor: cursorParam,
        filters: [{ type: 'contract', contractIds: [contractId] }],
        limit,
      });
    } else {
      // First load — use fallback-aware fetcher
      rpcResponse = await fetchEventsWithFallback(server, contractId, limit);
    }

    // Decode XDR; null = unknown/malformed event (skipped silently)
    const events = rpcResponse.events
      .map((e) => decodeContractEvent(e))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    console.info(
      `[api/ledger/events] fetched ${rpcResponse.events.length} raw, decoded ${events.length}`,
      `| oldest=${rpcResponse.oldestLedger} latest=${rpcResponse.latestLedger}`,
    );

    const body: LedgerEventsResponse = {
      events,
      cursor:       rpcResponse.cursor ?? '',
      latestLedger: rpcResponse.latestLedger,
      oldestLedger: rpcResponse.oldestLedger,
      hasMore:      rpcResponse.events.length === limit,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (err: unknown) {
    console.error('[api/ledger/events] Unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';

    const fallback: LedgerEventsResponse = {
      events:       [],
      cursor:       '',
      latestLedger: 0,
      oldestLedger: 0,
      hasMore:      false,
    };

    return NextResponse.json(
      { ...fallback, error: message },
      { status: 500 },
    );
  }
}
