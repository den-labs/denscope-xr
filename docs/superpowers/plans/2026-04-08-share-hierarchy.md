# Share Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Share on X" the primary action and native share the secondary across all 6 share surfaces.

**Architecture:** Pure UI refactor — reorder buttons, change labels, remove dropdowns. No new logic. All existing functions from `src/lib/share.ts` are reused as-is.

**Tech Stack:** Next.js 16 (React), TypeScript, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-08-share-hierarchy-design.md`

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/components/agent/AgentCertificateActions.tsx` | Add "Share on X" primary, demote "Share Certificate" to "Share", keep "Download" labeled |
| Modify | `src/components/feed/CertificateStation.tsx` | Swap button order, remove "Share on X →" link |
| Modify | `src/components/xray/XRayPanel.tsx` | Replace dropdown with "Share" button, add Web Share logic |
| Modify | `src/components/xray/ShareButton.tsx` | Remove dropdown, make direct "Share on X" button |
| Modify | `src/components/feed/FeedLine.tsx` | Add `title="Share on X"` tooltip |
| Modify | `src/app/agent/[chain]/[id]/page.tsx` | Remove standalone "Share on X" link (now in AgentCertificateActions) |

---

### Task 1: Update AgentCertificateActions

**Files:**
- Modify: `src/components/agent/AgentCertificateActions.tsx`

- [ ] **Step 1: Add X intent imports**

Add `buildXIntentUrl` and `buildCertificateShareText` to the imports at the top of the file:

```tsx
import { shareCertificate, buildXIntentUrl, buildCertificateShareText } from '@/lib/share'
```

- [ ] **Step 2: Add handleShareX function**

Add this function after the existing `handleDownload` function (after line 50):

```tsx
function handleShareX() {
  window.open(
    buildXIntentUrl(buildCertificateShareText({ chainId, agentId, name: agentName ?? undefined })),
    '_blank',
  )
}
```

- [ ] **Step 3: Replace button layout**

Replace the two buttons (lines 58-71) with the new three-button layout:

```tsx
<button
  onClick={handleShareX}
  className="bg-accent px-4 py-1.5 text-xs font-mono font-bold text-white hover:opacity-90 transition-opacity"
>
  Share on X
</button>

<button
  onClick={handleShare}
  className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
>
  Share
</button>

<button
  onClick={handleDownload}
  className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
>
  Download
</button>
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && git add src/components/agent/AgentCertificateActions.tsx && git commit -m "refactor: AgentCertificateActions — Share on X primary, Share secondary

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2: Update CertificateStation

**Files:**
- Modify: `src/components/feed/CertificateStation.tsx`

- [ ] **Step 1: Swap button order in action bar**

In the `StationContent` function, replace the action bar (lines 192-216) with:

```tsx
<div className="flex items-center gap-2">
  <button
    onClick={handleShareX}
    disabled={!agent}
    className="flex-1 bg-accent px-4 py-2.5 text-sm font-mono font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
  >
    Share on X
  </button>
  <button
    onClick={handleShare}
    disabled={!agent}
    className="border border-border px-3 py-2.5 text-sm font-mono text-text-secondary hover:text-text-primary hover:border-border-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    title="Share"
  >
    Share
  </button>
  <button
    onClick={handleDownload}
    disabled={!agent}
    className="border border-border px-3 py-2.5 text-sm text-text-muted hover:text-text-primary hover:border-text-primary transition-colors disabled:opacity-40"
    title="Download"
  >
    ⬇
  </button>
</div>
```

- [ ] **Step 2: Remove the "Share on X →" link**

Delete lines 209-215 (the `<button onClick={handleShareX}...>Share on X →</button>` below the action bar).

- [ ] **Step 3: Verify build**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && git add src/components/feed/CertificateStation.tsx && git commit -m "refactor: CertificateStation — Share on X primary, remove secondary link

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: Update XRayPanel

**Files:**
- Modify: `src/components/xray/XRayPanel.tsx`

- [ ] **Step 1: Add imports and state**

Add `shareCertificate` to the imports from `@/lib/share`:

```tsx
import {
  buildXIntentUrl,
  buildCertificateShareText,
  buildOwnerShareText,
  shareCertificate,
} from '@/lib/share'
```

Add state for share feedback. Find the existing `shareMenuOpen` state declaration and replace it:

```tsx
const [shareStatus, setShareStatus] = useState<string | null>(null)
const [copyModalUrl, setCopyModalUrl] = useState<string | null>(null)
```

- [ ] **Step 2: Add handleNativeShare function**

Add this function after the existing `handleShare` function:

```tsx
async function handleNativeShare() {
  if (!shareInput) return
  try {
    const certUrl = `/api/certificate/${shareInput.chainId}/${shareInput.agentId}`
    const res = await fetch(`${certUrl}?format=json`)
    if (!res.ok) return
    const data = await res.json()
    const hash = data.hash as string
    const state = (data.payload?.state ?? 'insufficient_signal') as ShareCardStateKey

    const result = await shareCertificate({
      hash,
      name: shareInput.name ?? null,
      state,
      lang: 'en',
    })

    if (result === 'copied') {
      setShareStatus('Link copied!')
      setTimeout(() => setShareStatus(null), 2000)
    } else if (result === 'modal') {
      setCopyModalUrl(`${window.location.origin}/verify/${hash}`)
    }
  } catch { /* silently fail */ }
}
```

- [ ] **Step 3: Remove toggleShareMenu function**

Delete the `toggleShareMenu` function (lines 128-130).

- [ ] **Step 4: Replace share buttons in certificate content**

Replace the "Share Certificate" button and "More share options..." dropdown (lines 211-240) with:

```tsx
{/* Primary CTA — Share on X */}
<button
  onClick={handleShare}
  className="w-full bg-accent px-4 py-3 text-sm font-mono font-bold text-white hover:opacity-90 transition-opacity"
>
  Share on X
</button>

{/* Secondary — Native Share */}
{shareStatus && (
  <p className="text-xs text-accent font-mono text-center">{shareStatus}</p>
)}
<button
  onClick={handleNativeShare}
  className="w-full border border-border bg-surface px-4 py-2.5 text-sm font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
>
  Share
</button>
```

- [ ] **Step 5: Update empty state button text**

Change the disabled button text at line 146 from "Share Certificate" to "Share on X".

- [ ] **Step 6: Add copy modal fallback**

Add the copy modal before the closing `</>` of `certificateContent`, after the "View Full Report" link:

```tsx
{copyModalUrl && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCopyModalUrl(null)}>
    <div className="bg-bg border border-border p-4 rounded-lg max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs text-text-muted mb-2 font-mono">Copy this link:</p>
      <input
        type="text"
        readOnly
        value={copyModalUrl}
        className="w-full bg-surface border border-border px-3 py-2 text-sm font-mono text-text-primary rounded"
        onFocus={(e) => e.target.select()}
      />
      <button onClick={() => setCopyModalUrl(null)} className="mt-3 w-full text-xs text-text-muted hover:text-text-primary font-mono">
        Close
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && git add src/components/xray/XRayPanel.tsx && git commit -m "refactor: XRayPanel — Share on X primary, remove dropdown

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: Simplify ShareButton

**Files:**
- Modify: `src/components/xray/ShareButton.tsx`

- [ ] **Step 1: Rewrite component**

Replace the entire component with:

```tsx
'use client'

import type { AgentSummary } from '@/types/agents'
import {
  buildXIntentUrl,
  buildCertificateShareText,
} from '@/lib/share'

export function ShareButton({ agent }: { agent: AgentSummary }) {
  const shareInput = {
    chainId: agent.chainId,
    agentId: agent.agentId,
    name: agent.metadata?.name,
  }

  function handleShareX() {
    window.open(buildXIntentUrl(buildCertificateShareText(shareInput)), '_blank')
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleShareX}
        className="bg-accent px-4 py-1.5 text-xs font-mono font-bold text-white hover:opacity-90 transition-opacity"
      >
        Share on X
      </button>
      <a
        href={`/agent/${agent.chainId}/${agent.agentId}`}
        className="border border-border bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-surface-hover hover:text-text-primary hover:border-border-bright transition-colors"
      >
        View Full Report
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && git add src/components/xray/ShareButton.tsx && git commit -m "refactor: ShareButton — direct Share on X, remove dropdown

Wolfcito 🐾 @akawolfcito"
```

---

### Task 5: Add tooltip to FeedLine

**Files:**
- Modify: `src/components/feed/FeedLine.tsx`

- [ ] **Step 1: Add tooltip to desktop share icon**

At line 110, add `title="Share on X"` to the share icon span:

```tsx
<span
  role="button"
  tabIndex={-1}
  onClick={handleShare}
  title="Share on X"
  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-accent px-2"
>
  <ShareIcon />
</span>
```

- [ ] **Step 2: Add tooltip to mobile share icon**

At line 128, add `title="Share on X"` to the mobile share icon span:

```tsx
<span
  role="button"
  tabIndex={-1}
  onClick={handleShare}
  title="Share on X"
  className="text-text-muted hover:text-accent shrink-0"
>
  <ShareIcon />
</span>
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && git add src/components/feed/FeedLine.tsx && git commit -m "fix: add 'Share on X' tooltip to FeedLine share icons

Wolfcito 🐾 @akawolfcito"
```

---

### Task 6: Remove duplicate Share on X from Agent Page

**Files:**
- Modify: `src/app/agent/[chain]/[id]/page.tsx`

- [ ] **Step 1: Remove separator and standalone link**

Remove three elements starting around line 255:

1. The separator span: `<span className="hidden md:inline-block border-l border-border h-5 mx-1" />`
2. The "Share on X" link (the `<a>` tag from lines 257-264)

Keep the `AgentCertificateActions` component and everything after the deleted link (the `<details>` embed section).

- [ ] **Step 2: Clean up unused imports**

Check if `buildXIntentUrl` and `buildCertificateShareText` are still used elsewhere in the file. If the deleted link was the only usage, remove them from the import statement.

- [ ] **Step 3: Verify build and tests**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && pnpm build && pnpm test
```

Expected: Build succeeds, all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/denlabs/denscope && git add src/app/agent/[chain]/[id]/page.tsx && git commit -m "refactor: remove duplicate Share on X from agent page

Now provided by AgentCertificateActions component.

Wolfcito 🐾 @akawolfcito"
```
