# Trust Certificate UX Phase 2 — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-03-15-trust-certificate-ux-p2-design.md`
**Milestone:** M10
**Date:** 2026-03-15

---

## 1. Executive Summary

- **Data first:** Supabase migration + Storage bucket before any endpoint code
- **Core utils second:** payload builder, canonicalization, hash generation, i18n labels, QR matrix — all pure functions, fully testable in isolation
- **Endpoints third:** certificate generation → snapshot serving → verify page, in dependency order
- **UI last:** update CertificateStation + agent detail page action bars, wire Web Share API
- **OG metadata:** update verify page and agent detail page OG after endpoints are stable
- **No new dependencies except `qrcode-generator`** (zero-dep, pure JS)

---

## 2. Execution Order

```
Phase A: Data Layer (no code deps)
  └─> Phase B: Core Utils (pure functions, no endpoints)
       └─> Phase C: Certificate Generation Endpoint
            ├─> Phase D: Snapshot Serving Endpoint
            └─> Phase E: Verify Page (SSR)
                 └─> Phase F: UI Integration (CertificateStation + agent detail)
```

---

## 3. Task Breakdown

### Phase A: Data Layer

#### A1. Supabase Migration — `certificate_snapshots` table

- **Objective:** Create table + indexes
- **Create:** `supabase/migrations/YYYYMMDDHHMMSS_certificate_snapshots.sql`
- **Depends on:** Nothing
- **Done when:**
  - Migration applies cleanly via `supabase db push`
  - Table exists with columns: `id`, `hash` (unique), `chain_id`, `agent_id` (integer), `payload` (jsonb), `image_key` (nullable text), `issued_at`
  - 3 indexes created: `idx_cert_hash`, `idx_cert_agent`, `idx_cert_issued`

#### A2. Supabase Storage Bucket — `certificates`

- **Objective:** Create public-read storage bucket (manual step)
- **Depends on:** Nothing
- **Done when:**
  - Bucket `certificates` exists in Supabase dashboard
  - Public read enabled, write restricted to service role
  - Documented in deploy checklist

---

### Phase B: Core Utils

#### B1. Certificate Payload + Canonicalization + Hash

- **Objective:** `CertificatePayload` type, `ShareCardStateKey` type export, `normalizeCertificatePayload()`, `canonicalize()`, `generateCertificateHash()`
- **Create:** `src/lib/trust/certificate.ts`
- **Modify:** `src/lib/trust/share-card-state.ts` — export `ShareCardStateKey` type + certificate palette config (additive, no changes to existing colors)
- **Depends on:** Nothing (pure functions)
- **Implementation notes:**
  - String normalization: `chainName` lowercase+trim, `controller` lowercase+trim, empty string → null for `name`/`controller`
  - Canonicalize as JSON array in fixed positional order
  - SHA-256 via Web Crypto API (`crypto.subtle.digest`)
  - Export `truncateHash(hash: string): string` → `first4...last4`
- **Done when:**
  - Unit tests pass for: canonicalization determinism, null handling, string normalization, hash generation, hash truncation display format
  - `ShareCardStateKey` exported and usable

#### B2. Certificate i18n Labels

- **Objective:** EN/ES label maps for all certificate text
- **Create:** `src/lib/trust/certificate-i18n.ts`
- **Depends on:** B1 (uses `ShareCardStateKey`)
- **Done when:**
  - All labels from spec i18n table present
  - `getLabels(lang: 'en' | 'es')` returns typed label object
  - Unit test verifies both language maps have same keys

#### B3. QR Matrix Generator

- **Objective:** Generate QR code data for rendering inside `next/og`
- **Create:** `src/lib/trust/qr.ts`
- **Depends on:** Nothing
- **Implementation notes:**
  - Install `qrcode-generator` (zero-dep)
  - Wrapper: `generateQRMatrix(url: string): boolean[][]` → matrix of modules
  - Rendering helper: `qrMatrixToRects(matrix, size, x, y)` → array of `{x, y, w, h}` for `next/og` rectangles
  - Error correction Level M
- **Done when:**
  - Unit test: known URL produces expected matrix dimensions
  - Unit test: rect output covers expected area

#### B4. Snapshot DB Operations

- **Objective:** CRUD for `certificate_snapshots` table
- **Create:** `src/lib/supabase/certificate-snapshots.ts`
- **Depends on:** A1 (table exists), B1 (types)
- **Functions:**
  - `findSnapshotByHash(hash: string)` → row or null
  - `insertSnapshot(hash, chainId, agentId, payload)` → row (uses `ON CONFLICT (hash) DO NOTHING` + re-select)
  - `updateImageKey(hash, imageKey)` → void
  - `findLatestSnapshot(chainId, agentId)` → row with non-null `image_key` or null (for agent detail OG)
- **Done when:**
  - Functions compile, types align with `CertificatePayload`
  - Integration tested via build pass (no DB mocking needed for unit)

---

### Phase C: Certificate Generation Endpoint

#### C1. Certificate PNG Endpoint

- **Objective:** `GET /api/certificate/[chain]/[id]` — generates or reuses deterministic certificate PNG
- **Create:** `src/app/api/certificate/[chain]/[id]/route.tsx`
- **Depends on:** B1, B2, B3, B4
- **Implementation notes:**
  - Route params: `chain` (string → resolve to chainId), `id` (string → `Number(id)`, validate `Number.isInteger` + > 0)
  - Query params: `lang` (`en`|`es`), `format` (`png`|`json`)
  - Flow: fetch trust score + metadata URI from `agents` table → `fetchAgentMetadataServer(uri)` → build payload → normalize → canonicalize → hash → check DB → render or serve
  - `format=json`: return `{ hash, payload, issuedAt }` with `X-Certificate-Hash` header
  - `format=png`: return ImageResponse (1200x630) with visual design per spec Section 2
  - Render: trust level palette from `share-card-state.ts` certificate config, seal SVG paths, QR from B3, i18n from B2
  - After render: store PNG in Supabase Storage `certificates/{chainId}/{agentId}/{hash}.png`, update `image_key`
  - If storage write fails: still return PNG inline, `image_key` stays null
  - `X-Certificate-Hash` header on all 200 responses
  - `Cache-Control: public, max-age=300`
  - Rate limit: 10/min per agent
  - Base URL for QR: `process.env.NEXT_PUBLIC_APP_URL`
- **Done when:**
  - Endpoint returns valid PNG for known agent
  - `format=json` returns hash + payload
  - Hash is deterministic (same agent state = same hash)
  - `X-Certificate-Hash` header present
  - Invalid `id` returns 400
  - Rate limiting works

---

### Phase D: Snapshot Serving Endpoint

#### D1. Snapshot Image Endpoint

- **Objective:** `GET /api/certificate/snapshot/[hash]` — serve stored PNG by hash
- **Create:** `src/app/api/certificate/snapshot/[hash]/route.ts`
- **Depends on:** B4, C1 (snapshots must exist)
- **Implementation notes:**
  - Resolves exclusively from stored snapshot — never reads current trust state
  - `image_key` present → proxy/redirect from Supabase Storage, `Cache-Control: public, max-age=86400`
  - `image_key` null → regenerate from snapshot payload (visual-equivalent), attempt storage write + update `image_key`
  - 404 if hash not found
  - No auth required
- **Done when:**
  - Returns PNG for existing hash
  - Returns 404 for unknown hash
  - Serves from storage when `image_key` exists
  - Regenerates when `image_key` is null

---

### Phase E: Verify Page

#### E1. Verification Page (SSR)

- **Objective:** `GET /verify/[hash]` — public verification page with OG metadata
- **Create:** `src/app/verify/[hash]/page.tsx`
- **Depends on:** B1, B2, B4, D1
- **Implementation notes:**
  - SSR: fetch snapshot by hash from DB
  - Found: render verification layout per spec (checkmark, payload fields, `issued_at` formatted as `DD Mon YYYY, HH:MM UTC`, certificate PNG if `image_key` exists, full hash with copy button, "View Live Report" link to `/agent/[chain]/[id]`)
  - Not found: "Certificate not found" — no agent data
  - Null display rules: `name` → "Unnamed Agent", `controller` → "No Controller"
  - OG metadata: `og:image` → `/api/certificate/snapshot/[hash]`, `og:url` → `${NEXT_PUBLIC_APP_URL}/verify/[hash]`
  - Discrete "Copy Link" icon next to hash
  - i18n: detect from snapshot payload or default to `en`
- **Done when:**
  - Page renders for valid hash
  - 404-like UI for invalid hash
  - OG metadata present in page source
  - Copy link works
  - Null fields display fallback labels

---

### Phase F: UI Integration

#### F1. Update `shareCertificate()` in share.ts

- **Objective:** Web Share API + fallback chain
- **Modify:** `src/lib/share.ts`
- **Depends on:** B2 (i18n labels)
- **Implementation notes:**
  - `shareCertificate(params)` with Web Share → clipboard → modal fallback
  - `params.agentId` is string (URL param context)
  - Verify URL built from `NEXT_PUBLIC_APP_URL`
  - Keep existing `buildXIntentUrl()` and `buildCertificateShareText()` unchanged
- **Done when:**
  - Function compiles, handles all 3 fallback levels
  - Unit test for URL construction

#### F2. Update CertificateStation Action Bar

- **Modify:** `src/components/feed/CertificateStation.tsx`
- **Depends on:** C1, F1
- **Implementation notes:**
  - Replace current share button with: "Share Certificate" (primary, calls `shareCertificate`) + download icon (fetches PNG as blob, triggers download) + "Share on X" (secondary, existing X intent)
  - On share/download: call `/api/certificate/[chain]/[id]?format=json` first to get hash, then trigger share with hash
  - Download filename: `denscope-certificate-{agentId_short}-{hash_short}.png`
- **Done when:**
  - Three actions visible and functional
  - Share triggers Web Share API on mobile
  - Download saves PNG file
  - X intent still works

#### F3. Update Agent Detail Page

- **Modify:** `src/app/agent/[chain]/[id]/page.tsx`
- **Depends on:** B4, C1, D1, F1
- **Implementation notes:**
  - Same action bar as F2
  - OG metadata: SSR queries `findLatestSnapshot(chainId, agentId)` → if row with non-null `image_key`, use `/api/certificate/snapshot/[hash]` as `og:image`; else fall back to `/api/og/agent/[chain]/[id]`
  - Embed moves to collapsible section (reposition only, no code change to `EmbedSnippet.tsx`)
- **Done when:**
  - Action bar matches CertificateStation
  - OG metadata updates when snapshot exists
  - Falls back correctly when no snapshot

---

## 4. Critical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **`next/og` SVG rendering limitations** — seal icons + QR as SVG paths inside ImageResponse may hit rendering quirks | Certificate image looks broken | Test seal + QR rendering early in C1. Keep SVG simple (basic paths, no gradients). Have fallback: simpler seal, QR fallback square. |
| **`qrcode-generator` in Edge runtime** — `next/og` routes may run in Edge; library must be pure JS | Import fails at runtime | Verify import works in Edge before building full endpoint. Candidate is zero-dep pure JS — low risk but must confirm. |
| **Supabase Storage bucket permissions** — manual step, easy to forget | PNG storage silently fails | Add to deploy checklist in A2. Endpoint degrades gracefully (serves inline PNG). |
| **Font rendering for accented characters (ñ, ó)** — `next/og` uses custom fonts; Inter must include Latin Extended glyphs | ES labels render with missing glyphs | Use Inter font file that includes full Latin character set. Test ES rendering in C1. |
| **Race condition on first certificate generation** — concurrent requests for same new hash | Duplicate insert attempt | Handled by `ON CONFLICT (hash) DO NOTHING` + re-select (specified in spec, implemented in B4). |

---

## 5. Minimum Validations Before Merge

### Unit Tests (required)

- [ ] `canonicalize()` determinism: same input → same output, different input → different output
- [ ] String normalization: whitespace, empty string → null, case normalization
- [ ] `generateCertificateHash()` produces 64-char hex
- [ ] `truncateHash()` → `xxxx...xxxx` format
- [ ] i18n: both language maps have identical key sets
- [ ] QR matrix: known URL → valid dimensions
- [ ] `shareCertificate()` URL construction uses `NEXT_PUBLIC_APP_URL`

### Integration / Build (required)

- [ ] `pnpm build` passes (catches type errors, route compilation)
- [ ] Migration applies cleanly to Supabase
- [ ] Certificate endpoint returns valid PNG for real agent on Celo
- [ ] `format=json` returns hash + payload
- [ ] Snapshot endpoint serves PNG by hash
- [ ] Verify page renders for valid hash, shows 404 for invalid
- [ ] OG metadata present on verify page (check page source)

### Manual Smoke (required)

- [ ] Generate certificate for known agent → visually inspect all 4 trust levels
- [ ] Share button → Web Share API fires on mobile (or clipboard on desktop)
- [ ] Download button → PNG saves with correct filename
- [ ] QR code in certificate scans → opens verify page
- [ ] Verify page shows correct data + certificate image
- [ ] Agent detail page OG → social preview shows certificate image (test with Twitter Card Validator or similar)
- [ ] ES language variant renders correctly (accented characters)

---

## Implementation Constraints Checklist

- [x] `NEXT_PUBLIC_APP_URL` as source of truth for all public URLs
- [x] `agentId` route param string → explicit `Number()` conversion + validation
- [x] Snapshot endpoint resolves from stored snapshot only, never current trust state
- [x] Storage bucket is manual step, documented in A2
- [x] Canonicalization: string normalization + fixed-order JSON array before SHA-256
- [x] `image_key` null fallback: serve inline PNG, attempt storage write for next time
