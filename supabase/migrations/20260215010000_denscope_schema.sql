-- DenScope: ERC-8004 event indexer schema

-- All on-chain events captured from ERC-8004 contracts
CREATE TABLE scope_events (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  event_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, tx_hash, log_index)
);

-- Indexes for common query patterns
CREATE INDEX idx_events_chain_block ON scope_events (chain_id, block_number);
CREATE INDEX idx_events_agent ON scope_events (chain_id, agent_id);
CREATE INDEX idx_events_kind ON scope_events (kind);
CREATE INDEX idx_events_timestamp ON scope_events (event_timestamp DESC);

-- Materialized agent state (computed from events)
CREATE TABLE agents (
  id TEXT PRIMARY KEY,  -- 'chainId:agentId'
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  owner TEXT,
  uri TEXT,
  metadata JSONB,
  feedback_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_chain ON agents (chain_id);
CREATE INDEX idx_agents_feedback ON agents (feedback_count DESC);

-- Indexer cursor state (where backfill/sync left off per chain)
CREATE TABLE indexer_cursors (
  chain_id INTEGER PRIMARY KEY,
  last_block BIGINT NOT NULL,
  last_block_hash TEXT,
  last_log_index INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deploy blocks (used by indexer to know where to start backfill)
CREATE TABLE deploy_blocks (
  chain_id INTEGER PRIMARY KEY,
  block_number BIGINT NOT NULL
);

INSERT INTO deploy_blocks (chain_id, block_number) VALUES
  (42220, 58396724),    -- Celo Mainnet
  (11142220, 17013547); -- Celo Sepolia

-- RLS: public read, service_role write
ALTER TABLE scope_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexer_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_blocks ENABLE ROW LEVEL SECURITY;

-- Anyone can read events and agents
CREATE POLICY "Public read events" ON scope_events FOR SELECT USING (true);
CREATE POLICY "Public read agents" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read deploy_blocks" ON deploy_blocks FOR SELECT USING (true);

-- Only service_role can write (indexer)
CREATE POLICY "Service write events" ON scope_events FOR INSERT WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);
CREATE POLICY "Service write agents" ON agents FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);
CREATE POLICY "Service write cursors" ON indexer_cursors FOR ALL USING (
  (SELECT auth.role()) = 'service_role'
);
