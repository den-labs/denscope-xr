-- Stellar replay recovery.
--
-- WHY
--
-- The payable testnet E2E on 2026-08-20 settled correctly but could not RECOVER:
-- re-sending the exact same, already-settled Stellar payment returned
-- 402 payment_invalid / invalid_exact_stellar_payload_simulation_failed instead
-- of the result it had bought.
--
-- The cause is rail-specific. The lifecycle looks up a delivered result only
-- AFTER the facilitator has confirmed the payer, so that a replay is never keyed
-- on an unverified address. On Stellar the facilitator's /verify re-simulates the
-- submitted transaction, and a transaction whose authorisation has been spent no
-- longer simulates — so verification refuses first and the keyed lookup is never
-- reached. Money safety held (nothing settled twice); recovery did not.
--
-- The fix is a lookup keyed on the PAYMENT rather than the payer:
--   (network, nonce) + endpoint
-- which the application can compute locally from the signed envelope, before
-- verification. This migration makes that lookup correct and unambiguous.
--
-- WHAT THIS MIGRATION DOES NOT DO
--
-- It does not touch the primary key. `x402_settlements` keeps
-- PRIMARY KEY (network, payer, nonce), and EVM semantics are unchanged.
--
-- It deliberately does NOT add a global UNIQUE (network, nonce). The `nonce`
-- column is rail-specific: on EVM it is an EIP-3009 authorization nonce, which is
-- unique per PAYER and not globally — two different payers may legitimately
-- present the same nonce value. A global constraint would reject a legitimate
-- second payer. On Stellar the column holds a canonical transaction fingerprint,
-- which IS globally unique per payment. The index below is therefore scoped to
-- Stellar networks only.
--
-- WHY UNIQUENESS IS LOAD-BEARING, NOT COSMETIC
--
-- The pre-verify lookup selects a single row by (network, nonce, endpoint). If
-- two rows could share a Stellar (network, nonce), that read would be ambiguous
-- and the application would fail closed — recovery would silently stop working
-- again. The database is the right place to guarantee it cannot happen.

-- ---------------------------------------------------------------------------
-- Partial unique index: Stellar networks only.
--
-- `network LIKE 'stellar:%'` covers stellar:testnet today and stellar:pubnet
-- later without a second migration, while excluding every eip155: row. The
-- predicate is immutable, so it is valid in a partial index.
--
-- This index also SERVES the recovery query: its leading (network, nonce)
-- columns match the lookup exactly, and `endpoint` is applied as a cheap recheck
-- on the single candidate row. No second index is needed.
-- ---------------------------------------------------------------------------
create unique index if not exists x402_settlements_stellar_payment_uniq
  on x402_settlements (network, nonce)
  where network like 'stellar:%';

comment on index x402_settlements_stellar_payment_uniq is
  'Stellar-only: one settlement per (network, canonical payment fingerprint). '
  'Enables pre-verify replay recovery, which a consumed Stellar payment needs '
  'because it can no longer be verified. Deliberately NOT global: an EIP-3009 '
  'nonce is unique per payer, not per network.';
