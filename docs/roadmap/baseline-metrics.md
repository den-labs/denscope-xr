# DenScope Baseline Metrics

**Date:** 2026-03-24
**Source:** Supabase production tables + npm registry API
**Purpose:** Phase 0 baseline for validation sprint (#137)

---

## Supabase Table Counts

| Table | Count | Interpretation |
|-------|-------|----------------|
| `scope_events` | 23,421 | On-chain events indexed (healthy pipeline) |
| `agents` | 4,336 | Agents discovered on Celo + Celo Sepolia |
| `trust_scores` | 4,317 | Pre-computed scores (matches agent count) |
| `certificate_snapshots` | 36 | Certificates generated (all internal testing) |
| `api_keys` | 2 | Both internal — zero external keys |
| `api_usage_log` | 4 entries | 31 total requests across 2 keys |
| `owner_profiles` | 0 | Zero agent claims |
| `x402_payments` | 0 | Zero micropayments |
| `alert_rules` | 0 | Zero webhook rules configured |
| `incidents` | 0 | Zero incidents detected |

## API Key Detail

| Key | Label | Tier | Created | Usage |
|-----|-------|------|---------|-------|
| Key 1 | DenScope Api Key | free | 2026-02-21 | 1 request (2026-02-23) |
| Key 2 | DenScope Discovery Daemon | free | 2026-03-14 | 30 requests (2026-03-14 to 2026-03-16) |

**API key -> first call conversion:** 2/2 keys made at least 1 call = 100%. However, both keys are internal. External conversion rate: N/A (0 external keys).

## Certificate Snapshots

- **Total:** 36 snapshots
- **Date range:** 2026-03-15 to 2026-03-24
- **Rate:** ~4 per day over 9 days
- **Origin:** All internal testing (no evidence of external generation or sharing)

## npm Download Counts (Week of 2026-03-16 to 2026-03-22)

| Package | Weekly Downloads | Version | Published |
|---------|-----------------|---------|-----------|
| `@denlabs/trust-client-core` | 16 | 0.1.0 | 2026-03-16 |
| `@denlabs/ayni-sdk` | 12 | 0.1.1 | 2026-03-16 |
| `@denlabs/trust-sdk` | 7 | 0.2.0 | 2026-03-16 |

**Total weekly downloads:** 35 (likely all from CI, monorepo installs, or self-testing)

## Interpretation

**The data is clear: DenScope has zero external usage.**

- 0 external API keys
- 0 agent claims
- 0 x402 payments
- 0 alert rules
- 0 incidents
- 36 certificates, all internal
- 35 npm downloads/week, likely self-installs

The pipeline is healthy (23K events, 4K agents, 4K scores) — the infrastructure works. But nobody outside the team has touched the product.

This baseline confirms that Phase 0 validation conversations (#138, #139) are essential. The numbers alone cannot tell us whether zero usage reflects lack of awareness or lack of demand. The conversations will.

---

## Queries Used (Reproducible)

```bash
# Supabase counts (requires SUPABASE_SERVICE_ROLE_KEY in .env)
# Method: HEAD request with Prefer: count=exact, read content-range header
source .env
URL="$NEXT_PUBLIC_SUPABASE_URL"
AUTH="apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
SVC="Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
curl -s -I "${URL}/rest/v1/<table>?select=id" \
  -H "$AUTH" -H "$SVC" -H "Prefer: count=exact" \
  | grep -i content-range

# npm downloads
curl -s "https://api.npmjs.org/downloads/point/last-week/@denlabs/trust-sdk"
curl -s "https://api.npmjs.org/downloads/point/last-week/@denlabs/trust-client-core"
curl -s "https://api.npmjs.org/downloads/point/last-week/@denlabs/ayni-sdk"
```
