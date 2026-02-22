import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Target = { label: string; chainId: number; agentId: number }

function parseTargets(args: string[]): Target[] {
  const targets: Target[] = []
  for (const arg of args) {
    // format: label:chainId:agentId  OR chainId:agentId
    const parts = arg.split(':')
    if (parts.length === 2) {
      const [chainIdRaw, agentIdRaw] = parts
      const chainId = Number(chainIdRaw)
      const agentId = Number(agentIdRaw)
      if (Number.isFinite(chainId) && Number.isFinite(agentId)) {
        targets.push({ label: `agent-${chainId}-${agentId}`, chainId, agentId })
      }
      continue
    }
    if (parts.length === 3) {
      const [label, chainIdRaw, agentIdRaw] = parts
      const chainId = Number(chainIdRaw)
      const agentId = Number(agentIdRaw)
      if (label && Number.isFinite(chainId) && Number.isFinite(agentId)) {
        targets.push({ label, chainId, agentId })
      }
    }
  }
  return targets
}

async function main() {
  const args = process.argv.slice(2)
  const baseUrl = process.env.OG_BASE_URL || 'http://localhost:3000'
  const outDir = resolve(process.cwd(), process.env.OG_OUT_DIR || '.tmp/og-review')
  const targets = parseTargets(args)

  if (targets.length === 0) {
    console.error('Usage: pnpm og:fetch <label:chainId:agentId> [<label:chainId:agentId> ...]')
    console.error('Example: pnpm og:fetch low:42220:1 high:42220:126 mix:11142220:5')
    process.exit(1)
  }

  await mkdir(outDir, { recursive: true })
  console.log(`Saving OG cards to ${outDir}`)

  for (const t of targets) {
    const url = `${baseUrl}/api/og/agent/${t.chainId}/${t.agentId}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[${t.label}] ${res.status} ${res.statusText} -> ${url}`)
      continue
    }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('image/png')) {
      const body = await res.text()
      console.error(`[${t.label}] Unexpected content-type ${contentType}`)
      console.error(body.slice(0, 500))
      continue
    }

    const bytes = new Uint8Array(await res.arrayBuffer())
    const file = resolve(outDir, `${t.label}-${t.chainId}-${t.agentId}.png`)
    await writeFile(file, bytes)
    console.log(`[${t.label}] OK -> ${file} (${bytes.byteLength} bytes)`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

