import type { AgentMetadata } from '@/types/agents'

const serviceLabels: Record<string, string> = {
  a2a: 'A2A',
  mcp: 'MCP',
  x402: 'x402',
  web: 'Web',
  ens: 'ENS',
  did: 'DID',
}

export function AgentServices({ metadata }: { metadata?: AgentMetadata }) {
  if (!metadata) return null
  const badges = [...metadata.services]
  if (metadata.x402) badges.push({ type: 'x402' as const })
  if (badges.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider text-foreground-muted">Services</h3>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((s, i) => (
          <span
            key={i}
            className={
              s.type === 'x402'
                ? 'status-pill status-pill-accent'
                : 'status-pill status-pill-success'
            }
          >
            {serviceLabels[s.type] ?? s.type}
            {s.version ? ` v${s.version}` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
