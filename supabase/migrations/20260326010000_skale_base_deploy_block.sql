-- Add SKALE Base (chain ID 1187947933) deploy block
-- First ERC-8004 event observed at block 1000054
INSERT INTO deploy_blocks (chain_id, block_number)
VALUES (1187947933, 1000054)
ON CONFLICT (chain_id) DO NOTHING;
