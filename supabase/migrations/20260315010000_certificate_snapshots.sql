-- Certificate snapshots for Trust Certificate UX Phase 2
-- Stores payload + hash for verifiable certificate generation

create table certificate_snapshots (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  chain_id integer not null,
  agent_id integer not null,
  payload jsonb not null,
  image_key text,
  issued_at timestamptz not null default now()
);

create index idx_cert_hash on certificate_snapshots (hash);
create index idx_cert_agent on certificate_snapshots (chain_id, agent_id);
create index idx_cert_issued on certificate_snapshots (issued_at desc);
