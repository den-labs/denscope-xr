import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Documentation — DenScope',
  description: 'DenScope Reputation API — query trust scores for any ERC-8004 agent',
}

export default function ApiDocsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-grid mx-auto max-w-4xl px-6 py-10">
        <nav className="font-mono text-xs text-text-muted uppercase tracking-wider">
          System / DenScope / API
        </nav>

        <h1 className="font-display text-3xl font-bold uppercase tracking-wider mt-4 text-text-primary">
          REPUTATION API
        </h1>
        <p className="mt-2 text-sm text-text-secondary max-w-2xl">
          Query trust scores, signals, and event history for any ERC-8004 agent.
          One curl command to answer: &ldquo;Can I trust this agent?&rdquo;
        </p>

        <Section title="Quick Start">
          <CodeBlock>{`curl -H "Authorization: Bearer ds_YOUR_KEY" \\
  https://denscope.vercel.app/api/v1/agent/42220/5/score`}</CodeBlock>
          <p className="text-xs text-text-muted font-mono mt-2">
            Get your API key from the Console &rarr; API Keys section.
          </p>
        </Section>

        <Section title="Authentication">
          <p className="text-sm text-text-secondary">
            All endpoints require an API key. Pass it via:
          </p>
          <ul className="list-disc list-inside text-sm text-text-secondary mt-2 space-y-1">
            <li><code className="text-xs font-mono">Authorization: Bearer ds_...</code> (recommended)</li>
            <li><code className="text-xs font-mono">X-API-Key: ds_...</code></li>
          </ul>
        </Section>

        <Section title="Rate Limits">
          <Table headers={['Tier', 'Requests/day', 'Price']}>
            <Row cells={['Free', '100', '$0']} />
            <Row cells={['Pro', '10,000', 'Coming soon']} />
          </Table>
          <p className="text-xs text-text-muted font-mono mt-2">
            Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
          </p>
        </Section>

        <Section title="Endpoints">
          <Endpoint
            method="GET"
            path="/api/v1/agent/{chain}/{id}"
            desc="Agent profile with metadata, feedback counts, and claim status."
          />
          <Endpoint
            method="GET"
            path="/api/v1/agent/{chain}/{id}/score"
            desc="Trust score (0-100) with confidence level and component breakdown."
          />
          <Endpoint
            method="GET"
            path="/api/v1/agent/{chain}/{id}/signals"
            desc="Active incidents/signals. Query param: ?status=open|resolved|all"
          />
          <Endpoint
            method="GET"
            path="/api/v1/agent/{chain}/{id}/events"
            desc="Paginated event history. Query params: ?limit=50&offset=0&kind=feedback"
          />
          <Endpoint
            method="GET"
            path="/api/v1/search"
            desc="Search agents by ID or owner. Query params: ?q=5&chainId=42220&limit=20"
          />
        </Section>

        <Section title="Trust Score Formula" id="trust-score-formula">
          <p className="text-sm text-text-secondary">
            The trust score is a transparent, deterministic number between 0 and 100.
            It updates after every on-chain event.
          </p>
          <CodeBlock>{`score = clamp(0, 100, round(
  0.40 * positive_ratio        // positive_count / feedback_count
+ 0.20 * age_score             // min(days_since_first_seen / 90, 1.0)
+ 0.20 * activity_score        // min(feedback_count / (active_days * 2), 1.0)
- 0.10 * incident_penalty      // min(critical*0.15 + warning*0.05, 1.0)
- 0.10 * sybil_penalty         // 1.0 if open sybil_cluster, else 0.0
) * 100)`}</CodeBlock>
          <div className="mt-4">
            <h4 className="text-xs text-text-muted uppercase font-mono mb-2">Confidence Levels</h4>
            <Table headers={['Level', 'Condition']}>
              <Row cells={['Low', '0 feedbacks']} />
              <Row cells={['Medium', '3-9 feedbacks']} />
              <Row cells={['High', '10+ feedbacks']} />
            </Table>
          </div>
        </Section>

        <Section title="Supported Chains">
          <Table headers={['Chain', 'Chain ID']}>
            <Row cells={['Celo Mainnet', '42220']} />
            <Row cells={['Celo Sepolia (testnet)', '11142220']} />
          </Table>
        </Section>

        <Section title="Error Responses">
          <Table headers={['Status', 'Meaning']}>
            <Row cells={['400', 'Invalid parameters']} />
            <Row cells={['401', 'Missing or invalid API key']} />
            <Row cells={['403', 'API key disabled']} />
            <Row cells={['404', 'Agent or score not found']} />
            <Row cells={['429', 'Rate limit exceeded']} />
            <Row cells={['500', 'Internal server error']} />
          </Table>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-text-primary border-b border-border pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-background border border-border p-4 mt-2 overflow-x-auto">
      <code className="text-xs font-mono text-text-primary whitespace-pre">{children}</code>
    </pre>
  )
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="bg-background border border-border p-4 mt-3">
      <div className="flex items-center gap-2">
        <span className="status-pill status-pill-accent text-[10px]">{method}</span>
        <code className="text-xs font-mono text-text-primary">{path}</code>
      </div>
      <p className="text-xs text-text-secondary font-mono mt-1">{desc}</p>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-xs font-mono mt-2">
      <thead>
        <tr className="border-b border-border">
          {headers.map((h) => (
            <th key={h} className="text-left text-text-muted uppercase py-2 pr-4">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Row({ cells }: { cells: string[] }) {
  return (
    <tr className="border-b border-border">
      {cells.map((c, i) => (
        <td key={i} className="text-text-secondary py-2 pr-4">{c}</td>
      ))}
    </tr>
  )
}
