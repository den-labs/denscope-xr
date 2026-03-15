# Trust Certificate UX Phase 2 — Design Spec

**Project:** DenScope (`den-labs/denscope-xr`)
**Milestone:** M10: Trust Certificate UX Phase 2
**Date:** 2026-03-15
**Status:** Draft

## Overview

Evolve the DenScope trust certificate from an OG-card-only social preview into a verifiable, distributable credential artifact. The certificate becomes a first-class product surface: shareable across any channel, visually differentiated by trust level, and independently verifiable via hash.

### Design Principles

- The verify URL (`/verify/[hash]`) is the unit of distribution, not the image
- The server-generated PNG is the canonical visual artifact — no client-side rendering
- Verification is hash-based (server-side SHA-256), not on-chain
- Bilingüe: English default, Spanish option
- Never hardcode domain — all URLs derived from `NEXT_PUBLIC_APP_URL` env var

### Scope

**In scope:** Certificate generation pipeline, visual design by trust level, hash-based verification, Web Share API distribution, QR code, PNG download, link preview via OG metadata.

**Out of scope (Phase 3 candidates):** PDF export, animated reveal/transitions, owner branding customization, batch generation, on-chain attestation, email delivery.

---

## Section 1: Certificate Generation Pipeline

### Endpoint

`GET /api/certificate/[chain]/[id]` — generation-by-GET. The output is a deterministic function of the agent's current trust state: same inputs produce same hash, same hash produces same artifact. Cacheable and addressable by design.

**Query params:**
- `lang` — `en` (default) | `es`
- `format` — `png` (default, 1200x630 via `next/og`) | `json` (raw snapshot data)

### Flow

1. Fetch trust score via `fetchTrustScore(chainId, agentId)`. Resolve agent metadata URI from `agents` table (`metadata_uri` column), then call `fetchAgentMetadataServer(metadataUri)` (existing helpers — note: `fetchAgentMetadataServer` takes a URI string, not chain/id)
2. Determine share card state via `getShareCardState` (existing in `share-card-state.ts`)
3. Build `CertificatePayload` from fetched data
4. Canonicalize payload → SHA-256 → `certificateHash`
5. Check `certificate_snapshots` table by hash:
   - **Hash exists, `image_key` present:** Serve PNG from Supabase Storage (no re-render)
   - **Hash exists, `image_key` null:** Re-render PNG, attempt storage write, update `image_key`
   - **Hash does not exist:** Insert row, render PNG, store in Supabase Storage, set `image_key`
6. Set response header `X-Certificate-Hash: {full_64_char_hex}`
7. Return PNG with `Cache-Control: public, max-age=300`

### Response Header Contract

`X-Certificate-Hash: {full_64_char_hex}` is included in every `200 OK` response originated by the app (freshly generated or served from storage). Note: intermediate caches (CDN, browser) may strip or omit custom headers on cached responses. The client should read the hash on first response and persist it locally (e.g., component state) rather than relying on re-reading it from cached responses. The generation endpoint also supports `?format=json` which returns the hash in the response body as a reliable alternative.

### vs OG Card

The existing OG card at `/api/og/agent/[chain]/[id]` is unchanged. It serves social previews for direct agent page links. The certificate endpoint generates a richer, verifiable image. No logic duplication — both share the same fetch and state helpers.

---

## Section 2: Certificate Visual Design

### Format

1200x630 PNG via `next/og`. Compatible with OG/social preview dimensions.

### Layout

```
+-----------------------------------------------------------+
|  DENSCOPE AGENT TRUST CERTIFICATE        [ERC-8004]       |  <- title bar (white text on level color)
|  Celo . 14 Mar 2026, 18:30 UTC                            |
+-----------------------------------------------------------+
|                                                            |
|        +------------+                                      |
|        |            |    0x1234...abcd                      |
|        |   [SEAL]   |    My Agent Name That...             |
|        |            |                                      |
|        | TRUSTWORTHY|    --------------------------         |
|        |            |    Trust Score    87 / 100            |
|        +------------+    ===============---                 |
|                          Signals: 42  (+38 . -4)           |
|                                                            |
+-----------------------------------------------------------+
|  [QR]  verify: 3f8a...c2d1  .  Controller: 0xOwn...er    |  <- credential bar
+-----------------------------------------------------------+
```

### Visual Hierarchy (top to bottom)

**1. Title bar** — Full-width band in trust level color. "DENSCOPE AGENT TRUST CERTIFICATE" left-aligned, `ERC-8004` badge right-aligned. Chain name + human-readable timestamp below in lighter weight. Format: `DD Mon YYYY, HH:MM UTC` (e.g., "14 Mar 2026, 18:30 UTC"). No ISO 8601 in the visual — raw ISO lives in the snapshot payload for verification.

**2. Body** — Two-column layout:

- **Left: Seal (protagonist).** 160x160px circular stamp. Trust level name in uppercase INSIDE the seal. The seal is the first visual element — communicates the verdict before anything is read. For `insufficient_signal`: dashed-stroke circle (no fill, `stroke-dasharray`), "INSUFFICIENT" / "DATA" in two lines centered — visually communicates "incomplete" without breaking circular form.

- **Right: Agent identity + score.** Agent address (monospace, truncated 6+4: `0x1234...abcd`). Agent name below (max 32 chars, ellipsis if longer, no quotes). Horizontal divider. Trust Score as `N / 100` with filled bar. "Signals" count with `(+positive . -negative)`.

**3. Credential bar** — Single-row footer. QR code (56x56, left edge, 4px padding). Verify hash + controller on single line: `verify: 3f8a...c2d1  .  Controller: 0xOwn...er`. No URL text — QR encodes the full verify URL. Controller truncated 6+4.

### Trust Level Palettes

| Level | Title Bar | Seal Fill | Seal Border | Semantic |
|---|---|---|---|---|
| `trustworthy` | `#065F46` (deep emerald) | `#059669` | `#D4AF37` (gold) | Earned trust, verified track record |
| `monitoring` | `#9A3412` (deep amber) | `#EA580C` | `#F59E0B` (amber) | Active, building history, not yet proven |
| `high_risk` | `#991B1B` (deep red) | `#DC2626` | `#7F1D1D` (dark red) | Negative signals, incidents detected |
| `insufficient_signal` | `#374151` (slate) | transparent | `#6B7280` (dashed stroke) | Not enough data to assess |

`trustworthy` is the only level with a gold accent — earned, not default. `insufficient_signal` uses transparent fill with dashed border as an "empty" state.

### Seal Designs

| Level | Icon | Seal Text | Rendering |
|---|---|---|---|
| `trustworthy` | Shield with checkmark | "TRUSTWORTHY" (1 line) | Solid fill + gold border |
| `monitoring` | Radar/pulse | "MONITORING" (1 line) | Solid fill + amber border |
| `high_risk` | Triangle with exclamation | "HIGH RISK" (1 line) | Solid fill + dark border |
| `insufficient_signal` | None | "INSUFFICIENT" / "DATA" (2 lines) | Dashed stroke, no fill, no icon |

All seals rendered as SVG paths inside `next/og` ImageResponse. Single-word labels at 14px, two-line labels at 12px.

### Overflow and Truncation Rules

| Field | Max Length | Truncation |
|---|---|---|
| Agent address | Always 6+4 | `0x1234...abcd` |
| Controller address | Always 6+4 | `0xOwn...er` |
| Agent name | 32 chars | Ellipsis: `"My Very Long Agent Na..."` |
| Certificate hash (display) | 4 + "..." + 4 | `3f8a...c2d1` (always this format, everywhere) |
| Chain name | 16 chars | Ellipsis (no known chain exceeds this) |

### Null Field Display Rules

| Field | Value | Display |
|---|---|---|
| `name` | `null` or `""` | "Unnamed Agent" (italic, muted color) |
| `controller` | `null` or `""` | "No Controller" (italic, muted) |

Consistent across certificate PNG, verification page, and OG metadata.

### QR Fallback

If QR generation fails at render time: replace with 56x56 solid square in credential bar accent color + verify hash at slightly larger font. Footer layout unchanged.

### Terminology (Phase 1 to Phase 2)

| Phase 1 | Phase 2 | Reason |
|---|---|---|
| "Trust Certificate" (generic) | "DenScope Agent Trust Certificate" | Product-specific, institutional |
| "Feedback: 42" | "Signals: 42 (+38 . -4)" | Native trust-infra language |
| "Confidence: HIGH" | Removed as standalone label | Implicit in trust level determination |
| "Owner" | "Controller" | Aligns with ERC-8004 semantics |
| "Powered by DenScope" | Removed | Title bar handles branding |
| ISO 8601 timestamp | `DD Mon YYYY, HH:MM UTC` | Human-readable; ISO stays in payload |

### i18n

Static labels via `lang` query param (`en` default, `es`):

| Key | EN | ES |
|---|---|---|
| title | "DenScope Agent Trust Certificate" | "Certificado de Confianza del Agente DenScope" |
| trustScore | "Trust Score" | "Puntaje de Confianza" |
| signals | "Signals" | "Señales" |
| controller | "Controller" | "Controlador" |
| verify | "verify" | "verificar" |
| trustworthy | "TRUSTWORTHY" | "CONFIABLE" |
| monitoring | "MONITORING" | "EN OBSERVACIÓN" |
| high_risk | "HIGH RISK" | "ALTO RIESGO" |
| insufficient_signal (line 1 / line 2) | "INSUFFICIENT" / "DATA" | "DATOS" / "INSUFICIENTES" (visual order: top="DATOS", bottom="INSUFICIENTES"; renderer may swap lines if layout requires — decision must be explicit in implementation, not ambiguous) |

---

## Section 3: Verification System

### Database

**Table:** `certificate_snapshots`

```sql
create table certificate_snapshots (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  chain_id integer not null,
  agent_id integer not null,
  payload jsonb not null,
  image_key text,                -- storage path: "certificates/{chain_id}/{agent_id}/{hash}.png"
  issued_at timestamptz not null default now()
);

create index idx_cert_hash on certificate_snapshots (hash);
create index idx_cert_agent on certificate_snapshots (chain_id, agent_id);
create index idx_cert_issued on certificate_snapshots (issued_at desc);
```

**Supabase Storage:** New bucket `certificates` (public read, authenticated write via service role).

### Timestamps

Single source of truth: `issued_at` (DB column). No `generatedAt` in the payload. The payload captures the score state; the table captures when the certificate was issued. The verification page reads `issued_at` from the row.

### Payload Schema

```typescript
// ShareCardStateKey is the string union: 'trustworthy' | 'monitoring' | 'high_risk' | 'insufficient_signal'
// (not the full ShareCardState object which includes label, colors, etc.)

interface CertificatePayload {
  agentId: number;              // numeric agent ID (matches codebase convention)
  chainId: number;
  chainName: string;
  name: string | null;
  controller: string | null;
  score: number;
  state: ShareCardStateKey;     // string key, not the full state object
  signalCount: number;
  positiveCount: number;
  negativeCount: number;
}
```

### Canonical Serialization

```typescript
function canonicalize(p: CertificatePayload): string {
  // Fixed-order JSON array. No delimiter ambiguity —
  // JSON.stringify handles escaping. Position IS the schema.
  return JSON.stringify([
    p.agentId,
    p.chainId,
    p.chainName,
    p.name,
    p.controller,
    p.score,
    p.state,
    p.signalCount,
    p.positiveCount,
    p.negativeCount,
  ]);
}

// hash = SHA-256(canonicalize(payload))
```

If a field is added to `CertificatePayload`, it is appended to the end of the array — never inserted mid-sequence — to preserve backward compatibility.

### String Normalization Rules

Before canonicalization, string fields must be normalized for deterministic hashing:
- `chainName`: lowercase, trimmed (`p.chainName.toLowerCase().trim()`)
- `name`: trimmed if non-null; empty string `""` normalized to `null`
- `controller`: lowercase, trimmed if non-null; empty string `""` normalized to `null` (addresses are case-insensitive in EVM)

These rules ensure that whitespace variations or mixed-case addresses never produce different hashes for the same logical agent state.

### Image Traceability

After PNG generation, the image is stored in Supabase Storage at `certificates/{chain_id}/{agent_id}/{hash}.png`. The `image_key` column records this path. If storage write fails (including bucket misconfiguration or Supabase Storage outage), `image_key` stays `null` — the certificate endpoint still returns the freshly-rendered PNG inline (render happens before storage write). The certificate remains valid (payload + hash are the source of truth), but without exact visual traceability until storage recovers.

### Idempotency

On each request, the endpoint computes payload from current trust state, canonicalizes, and hashes:
- **Hash exists, `image_key` present:** Serve from storage, no re-render
- **Hash exists, `image_key` null:** Re-render, attempt storage write, update `image_key`
- **Hash does not exist:** Insert row, render, store, set `image_key`

No duplicate rows, no unnecessary re-renders. Concurrent first-generation requests for the same hash: use `INSERT ... ON CONFLICT (hash) DO NOTHING` + subsequent `SELECT` to handle the race without errors.

### Verification Endpoint

`GET /verify/[hash]` — public page, no auth required.

- **Found:** Render verification page with all payload fields + `issued_at` from row. If `image_key` exists, display the original certificate PNG. Green checkmark + "This certificate was issued by DenScope on {issued_at formatted}". Link to current live report. OG metadata for social sharing.
- **Not found:** "Certificate not found" — no agent data exposed.

### Verification Page Layout

```
+--------------------------------------+
|  [checkmark] VERIFIED CERTIFICATE    |
|                                      |
|  [Certificate PNG if image_key]      |
|                                      |
|  Agent: 0x1234...abcd ("My Agent")   |
|  Chain: Celo                         |
|  Trust Score: 87 / 100               |
|  State: TRUSTWORTHY                  |
|  Signals: 42 (+38 / -4)             |
|  Controller: 0xOwn...er              |
|  Issued: 14 Mar 2026, 18:30 UTC     |
|                                      |
|  Hash: 3f8a9b...c2d1 (full)  [copy] |
|                                      |
|  [View Live Report ->]               |
+--------------------------------------+
```

### Rate Limiting

Certificate generation: 10/min per agent (via existing `increment_api_usage` RPC pattern). Verification: unlimited (public, read-only).

### No Expiration

Snapshots are historical records. A certificate from March 2026 is always verifiable even if the agent's current score changes. The verification page shows score at time of issuance, with a link to the current live report.

### Regeneration Policy

If `image_key` is null and the image is regenerated from payload, the render is **visual-equivalent** (same rendering function, same inputs) but not byte-identical (fonts loaded at render time, minor rendering differences). This is acceptable for OG preview purposes. The payload hash is the source of truth for verification, not the image.

---

## Section 4: Distribution

Priority order: Web Share API > Link preview > QR > PNG download.

### 4.1 Web Share API (Primary CTA)

```typescript
async function shareCertificate(params: {
  chain: string;
  agentId: string;
  hash: string;
  name: string | null;
  state: ShareCardStateKey;
  lang: 'en' | 'es';
}) {
  const verifyUrl = `${origin}/verify/${params.hash}`;
  const title = params.lang === 'es'
    ? 'Certificado de Confianza del Agente DenScope'
    : 'DenScope Agent Trust Certificate';
  const displayName = params.name ?? 'Unnamed Agent';
  const text = params.lang === 'es'
    ? `${displayName} . ${stateLabel(params.state, 'es')}\nVerificable en DenScope`
    : `${displayName} . ${stateLabel(params.state, 'en')}\nVerifiable on DenScope`;

  if (navigator.canShare?.({ url: verifyUrl })) {
    await navigator.share({ title, text, url: verifyUrl });
  } else if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(verifyUrl);
    // Toast: "Link copied"
  } else {
    // Final fallback: modal with readonly input + "Select All"
    openCopyModal(verifyUrl);
  }
}
```

**Fallback chain:** `navigator.share()` -> `navigator.clipboard.writeText()` -> modal with selectable URL.

**Behavior:**
- Mobile: native share sheet (WhatsApp, Telegram, LinkedIn, email, etc.)
- Desktop with support: OS share dialog
- Desktop without clipboard: modal with readonly input

The shared URL is always `/verify/[hash]`. The verify page has its own OG metadata so link previews render rich cards automatically.

Replaces X-only share as primary CTA. The X intent button moves to secondary position ("Share on X" text link).

### 4.2 Link Preview (OG on Verify Page)

`/verify/[hash]` serves OG metadata:

```html
<meta property="og:title" content="DenScope Trust Certificate - My Agent" />
<meta property="og:description" content="Trust Score: 87/100 . TRUSTWORTHY . 42 signals" />
<meta property="og:image" content="/api/certificate/snapshot/{hash}" />
<meta property="og:url" content="/verify/{hash}" />
<meta name="twitter:card" content="summary_large_image" />
```

`og:image` points to `/api/certificate/snapshot/[hash]` — resolves the PNG directly from Supabase Storage by hash. No chain/agentId dependency in the URL. If `image_key` is null, regenerates from payload (visual-equivalent).

### 4.3 QR Code

Defined in Section 2 as part of the certificate image (56x56 in credential bar).

- Generated server-side during certificate PNG rendering
- Library: lightweight QR matrix generator, rendered as rectangles within `next/og`
- Encodes: `${NEXT_PUBLIC_APP_URL}/verify/{hash}` (never hardcode domain)
- Error correction: Level M (15% recovery)
- No logo overlay (too small at 56px)
- Fallback: solid accent square + hash text if generation fails

### 4.4 PNG Download

Secondary action button (download icon) in CertificateStation and agent detail page.

- Fetches `/api/certificate/[chain]/[id]?lang={lang}` as blob
- Triggers download: `denscope-certificate-{agentId_short}-{hash_short}.png`
- No client-side rendering — server PNG is the canonical artifact

### 4.5 UI Integration

**CertificateStation** (live feed panel) — updated action bar:
```
[ Share Certificate ]  [ download icon ]  [ Share on X -> ]
  (Web Share/copy)        (PNG)             (X intent)
```

**Agent detail page** (`/agent/[chain]/[id]`) — same action bar in header. Embed moves to collapsible section below.

**Agent detail page OG rule:** SSR queries `certificate_snapshots` for the most recent snapshot: `WHERE chain_id = $1 AND agent_id = $2 ORDER BY issued_at DESC LIMIT 1`. If row exists with non-null `image_key`, `og:image` points to `/api/certificate/snapshot/[hash]`. Otherwise falls back to existing OG card at `/api/og/agent/[chain]/[id]`.

**Verify page** (`/verify/[hash]`) — "Copy Link" icon (discrete, no label) next to hash + "View Live Report" link. Minimal — it is a verification destination, not a distribution hub.

---

## Section 5: Integration Summary

### New Files

| File | Purpose |
|---|---|
| `src/app/api/certificate/[chain]/[id]/route.tsx` | Certificate PNG generation (next/og) |
| `src/app/api/certificate/snapshot/[hash]/route.ts` | Serve stored PNG by hash (for OG) |
| `src/app/verify/[hash]/page.tsx` | Public verification page (SSR) |
| `src/lib/trust/certificate.ts` | `CertificatePayload`, `canonicalize()`, `generateHash()`, snapshot DB ops |
| `src/lib/trust/certificate-i18n.ts` | Label maps (en/es) |
| `src/lib/trust/qr.ts` | QR matrix generation for next/og |

### Snapshot Image Endpoint Contract

`GET /api/certificate/snapshot/[hash]` — serves the stored certificate PNG by hash.

- **Input:** `hash` path parameter (64-char hex)
- **Found + `image_key` present:** Redirect or proxy PNG from Supabase Storage. `Content-Type: image/png`, `Cache-Control: public, max-age=86400` (24h — snapshot images are immutable)
- **Found + `image_key` null:** Regenerate PNG from snapshot payload (visual-equivalent, not byte-identical). Return inline. Attempt storage write + update `image_key` for next request.
- **Not found:** 404, no body
- No auth required. This endpoint exists primarily for `og:image` resolution.
- This route resolves exclusively from the stored snapshot — it never reads current trust state. The payload in `certificate_snapshots` is the sole data source.

### QR Library

Must be pure JS (no native deps) — `next/og` runs in an Edge-like environment. Candidate: `qrcode-generator` (zero-dep, returns matrix data suitable for rendering as SVG rectangles in ImageResponse).

### Modified Files

| File | Change |
|---|---|
| `src/lib/trust/share-card-state.ts` | Export palette config (colors, seal type) for certificate renderer |
| `src/lib/share.ts` | Add `shareCertificate()` with Web Share API + fallback chain |
| `src/components/feed/CertificateStation.tsx` | New action bar: Share + Download + X secondary |
| `src/app/agent/[chain]/[id]/page.tsx` | New action bar + OG metadata update for latest snapshot |
| `src/components/shared/EmbedSnippet.tsx` | Repositioned to collapsible section (no code changes) |

### Supabase Migration

One migration: `certificate_snapshots` table + 3 indexes. No changes to existing tables.

New Supabase Storage bucket: `certificates` (public read, service role write).

### Phase 1 Artifacts

| Artifact | Status |
|---|---|
| `/api/og/agent/[chain]/[id]` | Unchanged. Social preview for agent page links. |
| `share-card-state.ts` | Extended with new certificate palette/seal config exports (additive — existing Phase 1 colors like `#22C55E` for trustworthy remain unchanged to avoid breaking CertificateStation card styling) |
| `buildXIntentUrl()` / `buildCertificateShareText()` | Unchanged. Used by secondary X action. |
| CertificateStation | Modified action bar, same panel layout |
| Embed system | Unchanged, repositioned in agent detail page |

### Implementation Notes

**`agentId` type conversion:** Route params arrive as `string`. `CertificatePayload.agentId` is `number`. Convert explicitly with `Number(params.id)` and validate (`Number.isInteger`, > 0) before use. The `shareCertificate()` client function uses `agentId: string` because it only builds URLs — no type confusion with the payload.

**Supabase Storage bucket:** The `certificates` bucket must be created manually (Supabase dashboard or CLI: `supabase storage create certificates --public`). This is not part of the SQL migration.

### Key Migrations from Phase 1

- Primary CTA: X intent -> Web Share API
- Share text: includes verify URL instead of direct agent page URL
- Agent detail OG: can point to latest certificate snapshot (falls back to OG card)
