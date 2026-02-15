-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule the ERC-8004 event poller to run every minute.
-- pg_cron minimum interval is 1 minute (cron syntax).
-- With ~12 new blocks/min (5s block time) and CHUNK_SIZE=500,
-- the function catches up instantly on each invocation.
SELECT cron.schedule(
  'erc8004-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ioxjqabngtannnfsueqa.supabase.co/functions/v1/erc8004-poller',
    body := '{}'::jsonb
  );
  $$
);
