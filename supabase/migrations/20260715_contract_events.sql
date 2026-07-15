-- ═══════════════════════════════════════════════════════════
-- Pijin Treasury — Contract Event Store
-- Migration: 20260715_contract_events
--
-- Run once in the Supabase SQL Editor (Project → SQL Editor).
-- Safe to re-run — all statements are idempotent.
-- ═══════════════════════════════════════════════════════════

-- ─── contract_events ─────────────────────────────────────
-- One row per decoded Soroban contract event.
-- Primary key = Stellar RPC event ID (globally unique, monotonic).
-- payload column stores the full NetworkActivity object as JSONB
-- so the read path needs zero XDR decoding — just return it.
-- Denormalised columns (sender, gateway, amount, receiver_short_id)
-- exist solely for fast WHERE clauses without JSONB operators.

create table if not exists contract_events (
  -- Stellar RPC event ID format: "<ledger_seq_padded>-<event_index_padded>"
  -- Monotonically increasing: ORDER BY id DESC = newest first.
  id                text        primary key,

  tx_hash           text        not null,
  ledger            integer     not null,

  type              text        not null
                    check (type in (
                      'spend',
                      'deposit',
                      'withdraw',
                      'register_recipient',
                      'update_recipient'
                    )),

  -- ISO 8601 ledger close time from Stellar RPC
  timestamp         timestamptz not null,

  -- Full decoded NetworkActivity stored as JSONB.
  -- Read path returns payload directly — no XDR decode in the browser.
  payload           jsonb       not null,

  -- Denormalised columns for fast server-side filtering
  sender            text,               -- all event types (G... strkey)
  gateway           text,               -- spend only    (G... strkey)
  amount            text,               -- spend, deposit, withdraw (stroops, decimal string)
  receiver_short_id text,               -- spend only    (6-char Base62)

  indexed_at        timestamptz not null default now()
);

-- Indexes tuned for the query patterns in /api/ledger/events
create index if not exists idx_ce_id_desc      on contract_events (id desc);
create index if not exists idx_ce_type         on contract_events (type);
create index if not exists idx_ce_timestamp    on contract_events (timestamp desc);
create index if not exists idx_ce_sender       on contract_events (sender);
create index if not exists idx_ce_gateway      on contract_events (gateway);

-- GIN Trigram index for fast multi-column freetext search across ILIKE clauses
create extension if not exists pg_trgm;
create index if not exists idx_ce_search_trgm  on contract_events 
  using gin ((tx_hash || ' ' || coalesce(sender, '') || ' ' || coalesce(gateway, '') || ' ' || coalesce(receiver_short_id, '')) gin_trgm_ops);

-- ─── indexer_state ────────────────────────────────────────
-- Key/value store for the event indexer cursor.
-- 'contract_events_cursor' tracks the last Stellar RPC cursor
-- returned by getEvents so each indexer run fetches only new events.

create table if not exists indexer_state (
  key        text        primary key,
  value      text,                         -- opaque RPC cursor string (null = not started)
  updated_at timestamptz not null default now()
);

-- Seed the cursor row (idempotent)
insert into indexer_state (key, value)
values ('contract_events_cursor', null)
on conflict (key) do nothing;
