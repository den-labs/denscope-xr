-- Restrict public read policies on sensitive tables.
-- These tables were previously readable by anon, leaking key hashes,
-- webhook URLs, and owner addresses.

-- api_keys: drop public read, restrict to service_role
DROP POLICY IF EXISTS "Public read api_keys" ON api_keys;
CREATE POLICY "Service read api_keys" ON api_keys FOR SELECT
  USING ((SELECT auth.role()) = 'service_role');

-- alert_rules: drop public read, restrict to service_role
DROP POLICY IF EXISTS "Public read alert_rules" ON alert_rules;
CREATE POLICY "Service read alert_rules" ON alert_rules FOR SELECT
  USING ((SELECT auth.role()) = 'service_role');

-- webhook_logs: drop public read, restrict to service_role
DROP POLICY IF EXISTS "Public read webhook_logs" ON webhook_logs;
CREATE POLICY "Service read webhook_logs" ON webhook_logs FOR SELECT
  USING ((SELECT auth.role()) = 'service_role');

-- Cleanup expired nonces (runs every 10 min)
SELECT cron.schedule('clean-expired-nonces', '*/10 * * * *',
  $$DELETE FROM nonces WHERE expires_at < NOW()$$
);
