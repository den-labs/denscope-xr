-- TrustOps: evaluation audit log
-- Append-only record of trust evaluation calls (/api/v1/trust/evaluate).
-- Powers the TrustOps dashboard "recent evaluations" panel.

CREATE TABLE evaluation_log (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  preset TEXT,
  auth_method TEXT NOT NULL CHECK (auth_method IN ('api_key', 'x402')),
  called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recent-first ordering for the dashboard
CREATE INDEX idx_evaluation_log_called ON evaluation_log (called_at DESC);

-- Per-agent lookups
CREATE INDEX idx_evaluation_log_agent ON evaluation_log (chain_id, agent_id);

-- RLS: service_role writes/reads, no anon access
ALTER TABLE evaluation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluation_log_no_anon"
  ON evaluation_log FOR SELECT
  USING (false);

CREATE POLICY "evaluation_log_service_insert"
  ON evaluation_log FOR INSERT
  WITH CHECK (true);
