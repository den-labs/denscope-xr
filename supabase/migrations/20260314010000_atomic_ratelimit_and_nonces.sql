-- Atomic rate-limit increment (replaces non-atomic upsert+update pattern)
create or replace function increment_api_usage(
  p_api_key_id uuid,
  p_usage_date date
)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  insert into api_usage_log (api_key_id, usage_date, request_count)
  values (p_api_key_id, p_usage_date, 1)
  on conflict (api_key_id, usage_date)
  do update set request_count = api_usage_log.request_count + 1
  returning request_count into v_count;

  return v_count;
end;
$$;

-- Nonces table (replaces in-memory Map for serverless compatibility)
create table if not exists nonces (
  nonce text primary key,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists idx_nonces_expires on nonces (expires_at);
