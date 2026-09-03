-- Payment safety remediation: SEC-02 (idempotent result replay) and
-- SEC-04 (bounded unpaid facilitator verification).
--
-- NOT YET APPLIED to any environment. The application fails closed when these
-- objects are missing (a paid request returns 503 rather than risking a double
-- charge), so this migration must be applied BEFORE the code that depends on it
-- is deployed.

-- ---------------------------------------------------------------------------
-- SEC-02 — delivered-result store
--
-- Binds a settled payment to the exact response that was handed back for it, so
-- a client that loses the response can retry with the same payment and receive
-- the same bytes without recomputation and without a second settlement.
--
-- Natural key: (network, payer, nonce). `nonce` is the EIP-3009 authorization
-- nonce, which is unique per authorization by construction and is what prevents
-- on-chain replay; `payer` is the address the facilitator CONFIRMED, never the
-- one merely claimed in the payload. The primary key IS the idempotency
-- guarantee -- a duplicate insert raises 23505 rather than double-charging.
-- ---------------------------------------------------------------------------
create table if not exists x402_settlements (
  network        text        not null,
  payer          text        not null,
  nonce          text        not null,
  endpoint       text        not null,
  amount_micro   int         not null,
  tx_hash        text,
  response_status int        not null default 200,
  response_body  jsonb       not null,
  settled_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  primary key (network, payer, nonce)
);

create index if not exists idx_x402_settlements_expires
  on x402_settlements (expires_at);

create index if not exists idx_x402_settlements_payer
  on x402_settlements (payer, settled_at desc);

alter table x402_settlements enable row level security;

-- Delivered results are readable only through the service role. A payer
-- retrieves their result by presenting the payment again, not by querying.
create policy "x402_settlements_no_anon"
  on x402_settlements for select
  using (false);

-- ---------------------------------------------------------------------------
-- SEC-04 — bounded unpaid verification attempts
--
-- Anonymous callers can trigger an outbound facilitator /verify. This is the
-- shared, race-free counter that bounds how often. Fixed one-minute window,
-- keyed on the resolved client IP (see src/lib/x402/client-ip.ts for the trust
-- model). Mirrors the increment_api_usage pattern already used for API keys.
-- ---------------------------------------------------------------------------
create table if not exists x402_verify_attempts (
  bucket       text        not null,
  window_start timestamptz not null,
  attempts     int         not null default 0,
  primary key (bucket, window_start)
);

create index if not exists idx_x402_verify_attempts_window
  on x402_verify_attempts (window_start);

alter table x402_verify_attempts enable row level security;

create policy "x402_verify_attempts_no_anon"
  on x402_verify_attempts for select
  using (false);

create or replace function increment_x402_verify_attempts(
  p_bucket text,
  p_window_start timestamptz
)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  insert into x402_verify_attempts (bucket, window_start, attempts)
  values (p_bucket, p_window_start, 1)
  on conflict (bucket, window_start)
  do update set attempts = x402_verify_attempts.attempts + 1
  returning attempts into v_count;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention. Both tables are bounded working state, not history: the delivered
-- result store exists only to answer a retry, and the attempt counter only to
-- bound a one-minute window. x402_payments remains the append-only ledger.
-- ---------------------------------------------------------------------------
create or replace function prune_x402_ephemera()
returns void
language sql
as $$
  delete from x402_settlements where expires_at < now();
  delete from x402_verify_attempts where window_start < now() - interval '1 hour';
$$;
