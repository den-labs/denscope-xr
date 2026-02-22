import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function nowStamp(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}_${hh}${mm}`
}

async function main() {
  const outDir = resolve(process.cwd(), '.tmp/perf-review')
  await mkdir(outDir, { recursive: true })

  const file = resolve(outDir, `${nowStamp()}-perf-review.md`)

  const template = `# Denscope Perf + OG Review Session

Date: ${new Date().toISOString()}

## Goals

- Validate OG card visuals for 3 representative agents
- Validate thermals / CPU behavior after recent perf fixes
- Record observations and follow-up adjustments

## Step 1: Get OG candidates

Run:

\`\`\`bash
pnpm og:candidates
\`\`\`

Pick 3 cases:
- insufficient_signal
- trustworthy
- high_risk_or_monitoring

Selected candidates:
- low: chain=___ agent=___
- high: chain=___ agent=___
- mix: chain=___ agent=___

## Step 2: Start app locally

Run:

\`\`\`bash
pnpm dev
\`\`\`

## Step 3: Fetch OG cards locally

Run (replace IDs):

\`\`\`bash
pnpm og:fetch low:CHAIN:AGENT high:CHAIN:AGENT mix:CHAIN:AGENT
\`\`\`

Expected output directory:
- \`.tmp/og-review/\`

## Step 4: Visual Review Checklist (OG cards)

For each card (low / high / mix), verify:

- [ ] State label is understandable in 3-5s
- [ ] Color matches expected semantics
- [ ] Evidence line is readable: "feedbacks ERC-8004"
- [ ] Name + score + state hierarchy feels correct
- [ ] No visual clutter competes with core signal
- [ ] "Sin suficiente señal" feels honest (not broken)

### Notes: low / insufficient_signal

- Observations:
- Changes suggested:

### Notes: high / trustworthy

- Observations:
- Changes suggested:

### Notes: mix / high_risk_or_monitoring

- Observations:
- Changes suggested:

## Step 5: Thermal / CPU Review

### A) /console idle test (3-5 min)
- [ ] CPU seems stable / lower than before
- [ ] Laptop heat acceptable
- Notes:

### B) / (feed) active test (3-5 min)
- [ ] CPU/heat improved vs previous behavior
- [ ] Feed remains usable despite degraded animation at high volume
- Notes:

### C) Background tab test
- [ ] Switching tab reduces activity noticeably
- [ ] Heat/CPU drops when hidden
- Notes:

## Step 6: Follow-up Actions

- [ ] Adjust thresholds (state mapping)
- [ ] Adjust OG visual hierarchy / spacing
- [ ] Adjust copy (labels / evidence line)
- [ ] Additional perf tuning (if still needed)

## Summary

What improved:

What still feels heavy:

Next commit(s) to make:
`

  await writeFile(file, template, 'utf8')

  console.log(`Perf review template created:`)
  console.log(file)
  console.log(``)
  console.log(`Next:`)
  console.log(`1) pnpm og:candidates`)
  console.log(`2) pnpm dev`)
  console.log(`3) pnpm og:fetch low:CHAIN:AGENT high:CHAIN:AGENT mix:CHAIN:AGENT`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

