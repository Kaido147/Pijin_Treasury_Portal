// ═══════════════════════════════════════════════════════════
// Pijin Treasury — BFF API Route: Contract Event Ledger (Read)
//
// GET /api/ledger/events
//
// Reads from Supabase `contract_events` table — NOT from
// Stellar RPC. XDR decoding and RPC polling are handled by
// the separate /api/ledger/index route (the indexer).
//
// Query params:
//   before  — event ID (opaque string). Fetch events with
//             ID < before (keyset pagination for load-more).
//             Omit for the initial / poll load (newest first).
//   type    — ActivityType filter ('spend' | 'deposit' | ...).
//             Omit or pass 'all' to return all event types.
//   search  — full-text search across tx_hash, sender,
//             receiver_short_id, gateway columns.
//   limit   — page size (default 50, max 100).
//
// Pagination design:
//   Stellar RPC event IDs are monotonically increasing
//   (format: "<zero-padded ledger seq>-<event index>").
//   ORDER BY id DESC = newest events first.
//   Load-more: WHERE id < <cursor> ORDER BY id DESC.
//
// Response: LedgerEventsResponse JSON (same shape as before).
//   cursor = ID of the oldest event in this page
//            (pass as `before=` on the next load-more request).
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/infrastructure/supabase/server';
import type { LedgerEventsResponse, NetworkActivity } from '@/core/types';

// ─── Constants ───────────────────────────────────────────

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

// Valid ActivityType values — used to sanitise the type query param
const VALID_TYPES = new Set([
  'spend',
  'deposit',
  'withdraw',
  'register_recipient',
  'update_recipient',
]);

// ─── Route Handler ───────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl;

    // `before` = opaque event ID cursor for keyset load-more pagination
    const beforeParam = searchParams.get('before');
    // `type`   = server-side ActivityType filter
    const typeParam   = searchParams.get('type');
    // `search` = freetext search across denormalised columns
    const searchParam = searchParams.get('search')?.trim() ?? '';
    // `limit`  = page size
    const limitParam  = searchParams.get('limit');
    const limit       = Math.min(
      Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      MAX_LIMIT,
    );

    const supabase = createServiceClient();

    // ── Build Supabase query ──────────────────────────────
    //
    // Select: id + payload (full decoded event) + ledger (for KPIs).
    // Order: id DESC → newest Stellar events first.
    // Fetch limit+1 to detect hasMore without a COUNT(*) call.

    let query = supabase
      .from('contract_events')
      .select('id, payload, ledger')
      .order('id', { ascending: false })
      .limit(limit + 1);

    // Server-side type filter (skips JSONB operators — uses text column)
    if (typeParam && VALID_TYPES.has(typeParam)) {
      query = query.eq('type', typeParam);
    }

    // Server-side freetext search across denormalised text columns
    if (searchParam) {
      // Escape % and _ to prevent unintended ILIKE wildcards in user input
      const escaped = searchParam.replace(/[%_\\]/g, '\\$&');
      query = query.or(
        [
          `tx_hash.ilike.%${escaped}%`,
          `sender.ilike.%${escaped}%`,
          `receiver_short_id.ilike.%${escaped}%`,
          `gateway.ilike.%${escaped}%`,
        ].join(','),
      );
    }

    // Keyset pagination — events older (smaller ID) than the cursor
    if (beforeParam) {
      query = query.lt('id', beforeParam);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[api/ledger/events] DB error:', error.message);
      const fallback: LedgerEventsResponse = {
        events: [], cursor: '', latestLedger: 0, oldestLedger: 0, hasMore: false,
      };
      return NextResponse.json({ ...fallback, error: error.message }, { status: 500 });
    }

    // ── Shape response ────────────────────────────────────

    const rows       = data ?? [];
    const hasMore    = rows.length > limit;
    const pageRows   = hasMore ? rows.slice(0, limit) : rows;

    // payload column = the full decoded NetworkActivity stored at index time
    const events = pageRows.map((row) => row.payload as NetworkActivity);

    // cursor = ID of the oldest event in this page (for next load-more)
    const cursor = pageRows.length > 0
      ? (pageRows[pageRows.length - 1].id as string)
      : '';

    // latestLedger / oldestLedger — informational, derived from the page
    const ledgers      = pageRows.map((r) => r.ledger as number).filter(Boolean);
    const latestLedger = ledgers.length > 0 ? Math.max(...ledgers) : 0;
    const oldestLedger = ledgers.length > 0 ? Math.min(...ledgers) : 0;

    console.info(
      `[api/ledger/events] returned=${events.length} hasMore=${hasMore}`,
      beforeParam ? `before=${beforeParam.slice(0, 20)}` : 'initial',
    );

    const body: LedgerEventsResponse = {
      events,
      cursor,
      latestLedger,
      oldestLedger,
      hasMore,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        // Events come from DB — safe to micro-cache for 2s to absorb
        // duplicate requests from concurrent React renders / StrictMode.
        // Private: cursor is per-client. No shared-cache.
        'Cache-Control': 'private, max-age=2',
      },
    });
  } catch (err: unknown) {
    console.error('[api/ledger/events] Unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';

    const fallback: LedgerEventsResponse = {
      events: [], cursor: '', latestLedger: 0, oldestLedger: 0, hasMore: false,
    };

    return NextResponse.json({ ...fallback, error: message }, { status: 500 });
  }
}
