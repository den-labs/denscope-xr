-- M5: Signals, Incidents & Alerts

-- Incidents: detected signals for agents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  signal_kind TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  why_it_matters TEXT,
  source_tx_hash TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, agent_id, signal_kind, source_tx_hash)
);

CREATE INDEX idx_incidents_agent ON incidents (chain_id, agent_id, triggered_at DESC);
CREATE INDEX idx_incidents_open ON incidents (chain_id, agent_id)
  WHERE resolved_at IS NULL;

-- Alert rules: 3 predefined per agent, toggled on/off
CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('reputation_drop', 'sybil_detected', 'going_cold')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, agent_id, rule_type)
);

CREATE INDEX idx_alert_rules_agent ON alert_rules (chain_id, agent_id) WHERE enabled = true;

-- Webhook logs: audit trail
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES incidents(id),
  webhook_url TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_status INTEGER,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_incident ON webhook_logs (incident_id);

-- RLS
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read incidents" ON incidents FOR SELECT USING (true);
CREATE POLICY "Service write incidents" ON incidents FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Service update incidents" ON incidents FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Public read alert_rules" ON alert_rules FOR SELECT USING (true);
CREATE POLICY "Service write alert_rules" ON alert_rules FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Service update alert_rules" ON alert_rules FOR UPDATE
  USING ((SELECT auth.role()) = 'service_role');
CREATE POLICY "Service delete alert_rules" ON alert_rules FOR DELETE
  USING ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Public read webhook_logs" ON webhook_logs FOR SELECT USING (true);
CREATE POLICY "Service write webhook_logs" ON webhook_logs FOR INSERT
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Enable Realtime on incidents for live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
