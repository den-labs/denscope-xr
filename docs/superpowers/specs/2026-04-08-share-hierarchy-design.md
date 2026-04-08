# Share Hierarchy — "Share on X" Primary, Native Share Secondary

**Date:** 2026-04-08
**Status:** Approved

## Objective

Replace the current mixed share system with a consistent two-action hierarchy across all surfaces. "Share on X" becomes the primary, intentional distribution action. "Share" (Web Share API) becomes the secondary, general-purpose action. Dropdowns and mixed labeling are eliminated.

## Global Share Rule

All share surfaces follow this hierarchy:

| Priority | Label | Action | Styling |
|----------|-------|--------|---------|
| **Primary** | Share on X | `buildXIntentUrl(buildCertificateShareText(...))` | Accent bg (`bg-accent`), white text, bold |
| **Secondary** | Share | `shareCertificate(...)` (Web Share API → clipboard → modal) | Border/outline, `text-secondary` |
| **Tertiary** | Download | Download certificate PNG | Icon-only on compact surfaces; labeled button on Agent Dossier |

### Naming Rule

Use exactly these labels everywhere. No variations:
- "Share on X" (not "Share Certificate", not "Share on X →")
- "Share" (not "Share Certificate", not "More share options")
- "Download" (not "Download PNG", not "⬇")

### "I Own This Agent"

Removed from all share flows. This is an owner identity action, not a distribution action. It belongs in the owner console, not in general share UI.

## Changes Per Component

### 1. AgentCertificateActions (`src/components/agent/AgentCertificateActions.tsx`)

**Before:** "Share Certificate" (Web Share, primary) + "Download" (secondary)
**After:** "Share on X" (primary) + "Share" (secondary) + "Download" (tertiary, labeled button — not icon-only)

The component needs a new prop or import to build the X intent URL. Add `buildXIntentUrl` and `buildCertificateShareText` imports from `@/lib/share`.

New button order:
```
[Share on X]  — accent bg, calls window.open(buildXIntentUrl(...))
[Share]       — outline, calls existing handleShare() (Web Share API)
[Download]    — outline, calls existing handleDownload()
```

**Download visibility:** On Agent Dossier, Download stays as a labeled button (not icon-only). This is the page where people arrive by deep link and the certificate matters most. The button should be clearly accessible, just visually subordinate to the two share actions.

The existing copy modal fallback for Web Share API failure stays unchanged.

### 2. CertificateStation (`src/components/feed/CertificateStation.tsx`)

**Before:** "Share Certificate" (Web Share, primary) + ⬇ (download icon) + "Share on X →" (link, secondary)
**After:** "Share on X" (primary) + "Share" (secondary) + ⬇ (download icon)

In the sticky action bar (`StationContent`, lines 188-216):
- First button: "Share on X" with accent styling — calls existing `handleShareX()`
- Second button: "Share" with outline styling — calls existing `handleShare()` (Web Share)
- Third button: Download icon — calls existing `handleDownload()`
- Remove the "Share on X →" link below the action bar (line 209-215)

### 3. XRayPanel (`src/components/xray/XRayPanel.tsx`)

**Before:** "Share Certificate" (X intent, primary) + "More share options..." dropdown with "I Own This Agent"
**After:** "Share on X" (primary) + "Share" (secondary, Web Share API)

Changes at lines 211-240:
- Replace "Share Certificate" button label with "Share on X" (same `handleShare` click handler — already does X intent)
- Replace "More share options..." dropdown + "I Own This Agent" with a single "Share" button that calls `shareCertificate()`
- Remove `shareMenuOpen` state and `toggleShareMenu` function (lines 128-130)
- Add `shareCertificate` import from `@/lib/share`
- Add state for share feedback (`shareStatus`, `copyModalUrl`) and the copy modal fallback

Also update the empty state button text at line 146: "Share Certificate" → "Share on X"

### 4. ShareButton (`src/components/xray/ShareButton.tsx`)

**Before:** "Share Certificate" button that opens dropdown with "Share Certificate" + "I Own This Agent"
**After:** Direct "Share on X" button — no dropdown.

The component simplifies to a single button:
- Label: "Share on X"
- Click: `window.open(buildXIntentUrl(buildCertificateShareText(shareInput)), '_blank')`
- Remove `open` state, dropdown, and "I Own This Agent" link
- Keep the "View Full Report" link as-is (it's not a share action)

### 5. FeedLine (`src/components/feed/FeedLine.tsx`)

**Before:** Share icon on hover → X intent (no label)
**After:** No code change needed — already does X intent directly.

**Validation items:**
- Verify tooltip: add `title="Share on X"` to the share icon span (lines 107-113 desktop, lines 128-135 mobile)
- Verify icon: the current `ShareIcon` component (lines 50-63) renders a generic share/arrow icon. This is acceptable for a compact hover action — changing to an X logo would be over-engineering for a row-level icon. The tooltip provides disambiguation.

### 6. Agent Page (`src/app/agent/[chain]/[id]/page.tsx`)

**Before:** AgentCertificateActions + separator + standalone "Share on X" link (lines 248-264)
**After:** Only AgentCertificateActions — which now includes "Share on X" as its primary button.

Remove:
- The separator span (line 255)
- The standalone "Share on X" link (lines 257-264)

The updated AgentCertificateActions already provides "Share on X" as primary, so the standalone link becomes redundant.

## Shared Logic

No changes needed to `src/lib/share.ts`. All existing functions are reused:
- `buildXIntentUrl()` — builds X intent URL
- `buildCertificateShareText()` — community trust snapshot text
- `shareCertificate()` — Web Share API with fallback chain
- `buildOwnerShareText()` — kept in code but no longer surfaced in share UI

## Out of Scope

- OG image generation or certificate rendering
- Verify page copy button
- Nav restructure
- "I Own This Agent" relocation to owner console (separate task)
- X logo icon in FeedLine (tooltip is sufficient)

## Acceptance Criteria

- [ ] All share surfaces use exactly "Share on X", "Share", "Download" labels
- [ ] "Share on X" is visually primary (accent bg) in all surfaces
- [ ] "Share" uses Web Share API with clipboard and modal fallbacks
- [ ] No dropdowns in any share component
- [ ] "I Own This Agent" removed from all share flows
- [ ] Download is a labeled button (not icon-only) on Agent Dossier
- [ ] Download is icon-only on CertificateStation
- [ ] FeedLine share icon has `title="Share on X"` tooltip
- [ ] Agent Page has no duplicate "Share on X" link
- [ ] All existing tests pass
- [ ] Build succeeds
