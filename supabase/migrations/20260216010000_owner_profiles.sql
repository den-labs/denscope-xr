-- M4: Owner claim profiles
CREATE TABLE owner_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  display_name TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, agent_id)
);

CREATE INDEX idx_owner_profiles_wallet ON owner_profiles (wallet_address);
CREATE INDEX idx_owner_profiles_agent ON owner_profiles (chain_id, agent_id);

-- RLS: public read, service_role write
ALTER TABLE owner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read owner_profiles" ON owner_profiles FOR SELECT USING (true);
CREATE POLICY "Service write owner_profiles" ON owner_profiles FOR INSERT WITH CHECK (
  (SELECT auth.role()) = 'service_role'
);
CREATE POLICY "Service update owner_profiles" ON owner_profiles FOR UPDATE USING (
  (SELECT auth.role()) = 'service_role'
);
