-- M6: Reputation API tables

-- Pre-computed trust scores (updated by Edge Function after each event)
CREATE TABLE trust_scores (
  id TEXT PRIMARY KEY,  -- 'chainId:agentId' (matches agents.id)
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,  -- 0-100
  positive_ratio NUMERIC(5,4) NOT NULL DEFAULT 0,  -- 0.0000 to 1.0000
  activity_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  age_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  incident_penalty NUMERIC(5,4) NOT NULL DEFAULT 0,
  feedback_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  open_incidents INTEGER NOT NULL DEFAULT 0,
  confidence TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, agent_id)
);

CREATE INDEX idx_trust_scores_chain ON trust_scores (chain_id, agent_id);
CREATE INDEX idx_trust_scores_score ON trust_scores (score DESC);

-- API keys for external consumers
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  key_prefix TEXT NOT NULL,  -- first 8 chars for display (ds_xxxxxxxx...)
  key_hash TEXT UNIQUE NOT NULL,  -- SHA-256 of full key
  label TEXT NOT NULL DEFAULT 'default',
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  daily_limit INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_owner ON api_keys (owner_address);

-- API usage log (one row per day per key for rate counting)
CREATE TABLE api_usage_log (
  id BIGSERIAL PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (api_key_id, usage_date)
);

CREATE INDEX idx_api_usage_date ON api_usage_log (api_key_id, usage_date);

-- RLS policies
ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read trust_scores" ON trust_scores FOR SELECT USING (true);
CREATE POLICY "Service write trust_scores" ON trust_scores FOR INSERT WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);
CREATE POLICY "Service update trust_scores" ON trust_scores FOR UPDATE USING (
  (SELECT auth.role()) = 'service_role'
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read api_keys" ON api_keys FOR SELECT USING (true);
CREATE POLICY "Service write api_keys" ON api_keys FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manage api_usage_log" ON api_usage_log FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);
