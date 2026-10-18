// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Contract Event Indexer
//
// SERVER-ONLY module — never import from client code.
//
// Polls Stellar RPC for new contract events and upserts them
// into the Neon `contract_events` table.
//
// Cursor persistence: the opaque Stellar RPC cursor string is
// stored in `indexer_state` (key = 'contract_events_cursor').
// Each call to runIndexer() fetches only events newer than
// that cursor, so the indexer is safe to call on every poll tick.
//
// Idempotency: upsert uses ON CONFLICT (id) DO NOTHING.
// Calling runIndexer() multiple times with the same cursor
// is safe — duplicate events are silently skipped.
// ═══════════════════════════════════════════════════════════

import { rpc } from '@stellar/stellar-sdk';
import { decodeContractEvent } from './event-decoder';
import { getSql } from '@/infrastructure/db/sql';
import type { NetworkActivity, SpendActivity, DepositActivity, WithdrawActivity } from '@/core/types';

// ─── Constants ───────────────────────────────────────────

/** Max events fetched per RPC call. RPC hard-limit is 100. */
const INDEXER_LIMIT = 100;
const CURSOR_KEY    = 'contract_events_cursor';

// ─── Env helper ──────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[event-indexer] Missing required env: ${name}`);
  return value;
}

// ─── RPC helpers ─────────────────────────────────────────
// (Extracted from the original /api/ledger/events route)

/**
 * Parses oldestLedger out of a Stellar RPC error payload so we can
 * retry from the correct start when candidateStart is too old.
 */
function extractOldestLedgerFromError(err: unknown): number | null {
  try {
    const data =
      (err as { response?: { data?: unknown } })?.response?.data ??
      (err as { data?: unknown })?.data;

    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      const oldest =
        (d['error'] as Record<string, unknown>)?.['data'] &&
        typeof (d['error'] as Record<string, unknown>)?.['data'] === 'object'
          ? (
              (d['error'] as Record<string, unknown>)['data'] as Record<string, unknown>
            )?.['oldestLedger']
          : null;
      if (typeof oldest === 'number') return oldest;
    }

    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/oldestLedger[^\d]*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  } catch {
    // swallow parse failures
  }
  return null;
}

/**
 * Fetches events from the oldest available ledger, retrying with the
 * node's reported oldestLedger if our candidateStart is too far back.
 * Used only when no cursor exists (very first indexer run).
 */
export async function fetchEventsWithFallback(
  server: rpc.Server,
  contractId: string,
  limit: number,
): Promise<rpc.Api.GetEventsResponse> {
  const info           = await server.getLatestLedger();
  // 7 days ≈ 120,960 ledgers on testnet (1 ledger / 5-6 s).
  // We try 200 k (>7 days) and fall back if the node retains less.
  const candidateStart = Math.max(1, info.sequence - 200_000);

  const filter: rpc.Api.EventFilter = {
    type:        'contract',
    contractIds: [contractId],
  };

  try {
    return await server.getEvents({
      startLedger: candidateStart,
      filters:     [filter],
      limit,
    });
  } catch (firstErr: unknown) {
    console.warn(
      '[event-indexer] startLedger too old, attempting fallback from:',
      candidateStart,
    );

    const oldest = extractOldestLedgerFromError(firstErr);
    if (oldest !== null) {
      console.info('[event-indexer] Retrying from oldestLedger:', oldest);
      return server.getEvents({ startLedger: oldest, filters: [filter], limit });
    }

    // Last resort: 24 h window
    const conservativeStart = Math.max(1, info.sequence - 17_280);
    console.info('[event-indexer] Retrying from conservative 24h start:', conservativeStart);
    return server.getEvents({ startLedger: conservativeStart, filters: [filter], limit });
  }
}

// ─── DB row builder ──────────────────────────────────────

interface ContractEventRow {
  id:                string;
  tx_hash:           string;
  ledger:            number;
  type:              string;
  timestamp:         string;
  payload:           NetworkActivity;
  sender:            string | null;
  gateway:           string | null;
  amount:            string | null;
  receiver_short_id: string | null;
}

function toDbRow(event: NetworkActivity): ContractEventRow {
  const row: ContractEventRow = {
    id:                event.id,
    tx_hash:           event.txHash,
    ledger:            event.ledger,
    type:              event.type,
    timestamp:         event.timestamp,
    payload:           event,
    sender:            null,
    gateway:           null,
    amount:            null,
    receiver_short_id: null,
  };

  // Denormalised columns — populate for fast WHERE clauses
  if ('sender' in event) row.sender = (event as { sender: string }).sender;

  switch (event.type) {
    case 'spend': {
      const s = event as SpendActivity;
      row.gateway           = s.gateway;
      row.amount            = s.amount;          // stroops decimal string
      row.receiver_short_id = s.receiverShortId;
      break;
    }
    case 'deposit':
      row.amount = (event as DepositActivity).amount;
      break;
    case 'withdraw':
      row.amount = (event as WithdrawActivity).amount;
      break;
  }

  return row;
}

// ─── Public API ──────────────────────────────────────────

export interface IndexerResult {
  /** Number of new events written to Neon in this run */
  indexed: number;
  /** Latest Stellar RPC cursor after this run (null if unchanged) */
  cursor: string | null;
}

/**
 * Core indexer function.
 *
 * 1. Reads the last cursor from `indexer_state`.
 * 2. Fetches new events from Stellar RPC (cursor-based or fallback).
 * 3. Upserts decoded events into `contract_events`.
 * 4. Saves the new cursor back to `indexer_state`.
 *
 * Safe to call on every poll tick — idempotent by design.
 */
export async function runIndexer(): Promise<IndexerResult> {
  const contractId = requireEnv('CONTRACT_ID');
  const rpcUrl     = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL
                     ?? 'https://soroban-testnet.stellar.org';

  const sql = getSql();
  const server   = new rpc.Server(rpcUrl, { allowHttp: false });

  // ── 1. Read current cursor ────────────────────────────
  const stateRows = await sql`
    SELECT value
    FROM public.indexer_state
    WHERE key = ${CURSOR_KEY}
    LIMIT 1
  `;

  const currentCursor: string | null = (stateRows[0]?.value as string | undefined) ?? null;

  // ── 2. Fetch from Stellar RPC ─────────────────────────
  let rpcResponse: rpc.Api.GetEventsResponse;

  if (currentCursor) {
    try {
      rpcResponse = await server.getEvents({
        cursor:  currentCursor,
        filters: [{ type: 'contract', contractIds: [contractId] }],
        limit:   INDEXER_LIMIT,
      });
    } catch (cursorErr: unknown) {
      console.warn(
        `[event-indexer] Saved cursor (${currentCursor.slice(0, 20)}...) rejected by RPC. Attempting self-healing fallback...`,
      );
      const oldest = extractOldestLedgerFromError(cursorErr);
      if (oldest !== null) {
        console.info('[event-indexer] Resyncing from oldestLedger:', oldest);
        rpcResponse = await server.getEvents({
          startLedger: oldest,
          filters:     [{ type: 'contract', contractIds: [contractId] }],
          limit:       INDEXER_LIMIT,
        });
      } else {
        rpcResponse = await fetchEventsWithFallback(server, contractId, INDEXER_LIMIT);
      }
    }
  } else {
    // First ever run — fetch full available history
    rpcResponse = await fetchEventsWithFallback(server, contractId, INDEXER_LIMIT);
  }

  const newCursor = rpcResponse.cursor ?? currentCursor;

  // ── 3. Decode and upsert ──────────────────────────────
  const decoded = rpcResponse.events
    .map((e) => decodeContractEvent(e))
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (decoded.length > 0) {
    const rows = decoded.map(toDbRow);

    const payload = JSON.stringify(rows.map((row) => ({
      ...row,
      event_timestamp: row.timestamp,
    })));

    await sql`
      INSERT INTO public.contract_events (
        id, tx_hash, ledger, type, "timestamp", payload, sender, gateway, amount, receiver_short_id
      )
      SELECT
        id, tx_hash, ledger, type, event_timestamp, payload, sender, gateway, amount, receiver_short_id
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(
        id text,
        tx_hash text,
        ledger integer,
        type text,
        event_timestamp timestamptz,
        payload jsonb,
        sender text,
        gateway text,
        amount text,
        receiver_short_id text
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // ── 4. Persist new cursor ─────────────────────────────
  if (newCursor && newCursor !== currentCursor) {
    await sql`
      INSERT INTO public.indexer_state (key, value, updated_at)
      VALUES (${CURSOR_KEY}, ${newCursor}, now())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
    `;
  }

  console.info(
    `[event-indexer] indexed=${decoded.length}`,
    `raw=${rpcResponse.events.length}`,
    `cursor=${newCursor?.slice(0, 24) ?? 'none'}`,
  );

  return { indexed: decoded.length, cursor: newCursor };
}
