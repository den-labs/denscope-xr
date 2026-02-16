-- M7: x402 Trust Oracle — payment audit trail
-- Append-only, immutable. No UPDATEs, no DELETEs.

CREATE TABLE x402_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INT NOT NULL,
  agent_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  amount_micro INT NOT NULL,
  tx_hash TEXT,
  facilitator TEXT NOT NULL,
  settled_at TIMESTAMPTZ DEFAULT NOW(),
  network TEXT NOT NULL,
  stablecoin TEXT DEFAULT 'USDC'
);

-- Revenue analytics: recent payments first
CREATE INDEX idx_x402_payments_settled ON x402_payments (settled_at DESC);

-- Payer lookup
CREATE INDEX idx_x402_payments_payer ON x402_payments (payer_address);

-- Per-agent revenue queries
CREATE INDEX idx_x402_payments_agent ON x402_payments (chain_id, agent_id);

-- RLS: service_role can write, owners can read their claimed agents' payments
ALTER TABLE x402_payments ENABLE ROW LEVEL SECURITY;

-- Anon/public cannot access
CREATE POLICY "x402_payments_no_anon"
  ON x402_payments FOR SELECT
  USING (false);

-- Service role bypasses RLS by default, but explicit policy for clarity
CREATE POLICY "x402_payments_service_insert"
  ON x402_payments FOR INSERT
  WITH CHECK (true);
