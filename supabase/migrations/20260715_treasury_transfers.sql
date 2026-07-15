-- Treasury funding telemetry used by the Command Center.
-- The Stellar ledger remains the source of truth; this table only tracks
-- the short broadcast-to-finalization window that Horizon does not expose.

create table if not exists treasury_transfers (
  tx_hash       text primary key,
  destination  text not null,
  asset_code   text not null default 'XLM',
  amount        numeric(20, 7) not null check (amount > 0),
  status        text not null default 'pending'
                check (status in ('pending', 'confirmed', 'failed')),
  submitted_at  timestamptz not null default now(),
  confirmed_at  timestamptz,
  updated_at    timestamptz not null default now()
);

create index if not exists idx_treasury_transfers_status
  on treasury_transfers (status);

create index if not exists idx_treasury_transfers_destination
  on treasury_transfers (destination);

comment on table treasury_transfers is
  'Portal-submitted treasury transfers. Reconciled against Stellar RPC by the dashboard.';
