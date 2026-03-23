import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Documentation — DenScope',
  description: 'DenScope Reputation API — query trust scores for any ERC-8004 agent',
}

export default function ApiDocsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-grid mx-auto max-w-4xl px-6 py-10">
        <nav className="font-mono text-xs text-foreground-muted uppercase tracking-wider">
          System / DenScope / API
        </nav>

        <h1 className="font-display text-2xl font-bold uppercase tracking-wider mt-4 text-foreground">
          REPUTATION API
        </h1>
        <p className="mt-2 text-sm text-foreground-secondary max-w-2xl">
          Query trust scores, signals, and event history for any ERC-8004 agent.
          One curl command to answer: &ldquo;Can I trust this agent?&rdquo;
        </p>

        <Section title="Quick Start">
          <CodeBlock>{`curl -H "Authorization: Bearer ds_YOUR_KEY" \\
  https://denscope.vercel.app/api/v1/agent/42220/5/score`}</CodeBlock>
          <p className="text-xs text-foreground-muted font-mono mt-2">
            Get your API key from the Console &rarr; API Keys section.
          </p>
        </Section>

        <Section title="Start with SDK" id="start-with-sdk">
          <p className="text-sm text-foreground-secondary">
            Prefer TypeScript? Use <code className="text-xs font-mono">@denlabs/trust-sdk</code> to query the same trust data used by the portal.
            It supports both API keys and x402 payment mode.
          </p>
          <p className="text-xs text-foreground-muted font-mono mt-2">
            Repo: <a className="underline hover:text-foreground" href="https://github.com/den-labs/trust-sdk" target="_blank" rel="noreferrer">github.com/den-labs/trust-sdk</a>
          </p>
          <p className="text-xs text-foreground-muted font-mono mt-1">
            Example: <a className="underline hover:text-foreground" href="https://github.com/den-labs/trust-sdk/blob/main/examples/get-score.mjs" target="_blank" rel="noreferrer">examples/get-score.mjs</a>
          </p>
          <p className="text-xs text-foreground-muted font-mono mt-1">
            x402 Example: <a className="underline hover:text-foreground" href="https://github.com/den-labs/trust-sdk/blob/main/examples/get-score-x402.mjs" target="_blank" rel="noreferrer">examples/get-score-x402.mjs</a>
          </p>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">Install</h4>
          <CodeBlock>{`pnpm add @denlabs/trust-sdk

# For x402 payment mode (optional)
pnpm add viem`}</CodeBlock>
          <p className="text-xs text-foreground-muted font-mono mt-2">
            Local SDK repo example (after cloning): <code className="text-xs">DENSCOPE_API_KEY=ds_xxx pnpm example:get-score</code>
          </p>
          <p className="text-xs text-foreground-muted font-mono mt-1">
            Local x402 example: <code className="text-xs">DENSCOPE_PRIVATE_KEY=0x... pnpm example:get-score:x402</code>
          </p>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">API Key Example</h4>
          <CodeBlock>{`import { DenScope } from '@denlabs/trust-sdk'

const ds = new DenScope({ apiKey: 'ds_...' })

const { score } = await ds.getScore(42220, 5)
console.log(score.value, score.confidence)

const { signals } = await ds.getSignals(42220, 5, { status: 'open' })
const { agents } = await ds.search({ q: '0xabc', chainId: 42220, limit: 5 })`}</CodeBlock>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">x402 Example (wallet/agent)</h4>
          <CodeBlock>{`import { DenScope } from '@denlabs/trust-sdk'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')
const ds = new DenScope({ account })

// SDK handles: 402 -> decode PAYMENT-REQUIRED -> sign -> retry
const { score } = await ds.getScore(42220, 5)
const { signals } = await ds.getSignals(42220, 5)`}</CodeBlock>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">Error Handling Example</h4>
          <CodeBlock>{`import {
  DenScope,
  DenScopeError,
  AuthenticationError,
  PaymentRequiredError,
} from '@denlabs/trust-sdk'

const ds = new DenScope({ apiKey: process.env.DENSCOPE_API_KEY! })

try {
  const { score } = await ds.getScore(42220, 5)
  console.log(score.value, score.confidence)
} catch (e) {
  if (e instanceof AuthenticationError) {
    console.error('Invalid or disabled API key')
  } else if (e instanceof PaymentRequiredError) {
    console.error('x402 payment required (use wallet mode or X-PAYMENT flow)')
  } else if (e instanceof DenScopeError) {
    console.error('Denscope API error', e.status, e.body)
  } else {
    console.error('Unexpected error', e)
  }
}`}</CodeBlock>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">Interpretation Guide (Portal-Aligned)</h4>
          <p className="text-sm text-foreground-secondary">
            The API returns raw score data (<code className="text-xs font-mono">value</code>, <code className="text-xs font-mono">confidence</code>, feedback stats).
            In the portal, Denscope maps those fields into semantic states for faster reading.
          </p>
          <Table headers={['Portal State', 'Starter Interpretation (guide)', 'Typical signals']}>
            <Row cells={['Sin suficiente señal', 'Too little evidence for a strong trust/risk label', 'Low feedback count or low confidence']} />
            <Row cells={['En observación', 'Early or mixed signal; monitor before relying', 'Some feedback but not enough evidence / confidence']} />
            <Row cells={['Confiable', 'Positive signal with enough evidence', 'Higher feedback count + positive ratio + medium/high confidence']} />
            <Row cells={['Alto riesgo', 'Negative signal with enough evidence', 'Negative dominance + medium/high confidence']} />
          </Table>
          <p className="text-xs text-foreground-muted font-mono mt-2">
            Note: Semantic labels are UX interpretation helpers. Use raw fields for strict programmatic decisions.
          </p>
        </Section>

        <Section title="Authentication">
          <p className="text-sm text-foreground-secondary">
            Two authentication methods are supported. Use whichever fits your use case:
          </p>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">Option 1: API Key (for developers)</h4>
          <p className="text-sm text-foreground-secondary">
            Best for bulk integrations, dashboards, and analytics. Get a key from the Console.
          </p>
          <ul className="list-disc list-inside text-sm text-foreground-secondary mt-2 space-y-1">
            <li><code className="text-xs font-mono">Authorization: Bearer ds_...</code> (recommended)</li>
            <li><code className="text-xs font-mono">X-API-Key: ds_...</code></li>
          </ul>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">Option 2: x402 Payment (for agents)</h4>
          <p className="text-sm text-foreground-secondary">
            Any wallet can query trust data with zero setup. No API key, no account needed.
            Available on <code className="text-xs font-mono">/score</code> and <code className="text-xs font-mono">/signals</code> endpoints.
          </p>
          <ul className="list-disc list-inside text-sm text-foreground-secondary mt-2 space-y-1">
            <li>Call the endpoint without auth &rarr; receive HTTP 402 + <code className="text-xs font-mono">PAYMENT-REQUIRED</code> header</li>
            <li>Sign an EIP-712 authorization (off-chain, no gas)</li>
            <li>Retry with <code className="text-xs font-mono">X-PAYMENT</code> header &rarr; receive the data</li>
          </ul>
        </Section>

        <Section title="Rate Limits">
          <Table headers={['Tier', 'Requests/day', 'Price']}>
            <Row cells={['Free', '100', '$0']} />
            <Row cells={['Pro', '10,000', 'Coming soon']} />
          </Table>
          <p className="text-xs text-foreground-muted font-mono mt-2">
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
            desc="Trust score (0-100) with confidence level and component breakdown. Supports x402 ($0.001/call)."
          />
          <Endpoint
            method="GET"
            path="/api/v1/agent/{chain}/{id}/signals"
            desc="Active incidents/signals. Query param: ?status=open|resolved|all. Supports x402 ($0.0005/call)."
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
          <p className="text-sm text-foreground-secondary">
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
            <h4 className="text-xs text-foreground-muted uppercase font-mono mb-2">Confidence Levels</h4>
            <Table headers={['Level', 'Condition']}>
              <Row cells={['Low', '0 feedbacks']} />
              <Row cells={['Medium', '3-9 feedbacks']} />
              <Row cells={['High', '10+ feedbacks']} />
            </Table>
          </div>
        </Section>

        <Section title="x402 Payment Flow" id="x402-payment-flow">
          <p className="text-sm text-foreground-secondary">
            The <code className="text-xs font-mono">/score</code> and <code className="text-xs font-mono">/signals</code> endpoints
            accept x402 micropayments via the UltravioletaDAO facilitator on Celo. This enables autonomous agents to query trust
            data without human-managed API keys.
          </p>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">Flow</h4>
          <CodeBlock>{`# 1. Call without auth -> get 402 with payment instructions
curl -i https://denscope.vercel.app/api/v1/agent/42220/5/score
# HTTP/2 402
# PAYMENT-REQUIRED: <base64-encoded JSON>

# 2. Decode PAYMENT-REQUIRED header -> sign EIP-712 off-chain

# 3. Retry with X-PAYMENT header
curl -H "X-PAYMENT: <base64-encoded payment>" \\
  https://denscope.vercel.app/api/v1/agent/42220/5/score
# HTTP/2 200 { score: { value: 85, ... } }`}</CodeBlock>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">Pricing</h4>
          <Table headers={['Endpoint', 'Price (USDC)', 'micro-USDC']}>
            <Row cells={['/score', '$0.001', '1000']} />
            <Row cells={['/signals', '$0.0005', '500']} />
          </Table>

          <h4 className="text-xs text-foreground-muted uppercase font-mono mt-4 mb-2">Details</h4>
          <ul className="list-disc list-inside text-sm text-foreground-secondary mt-2 space-y-1">
            <li>Protocol: x402 v2 (HTTP 402 Payment Required)</li>
            <li>Settlement: EIP-3009 TransferWithAuthorization (off-chain signature, no gas for the caller)</li>
            <li>Stablecoin: USDC on Celo (chain ID 42220)</li>
            <li>Facilitator: UltravioletaDAO (<code className="text-xs font-mono">facilitator.ultravioletadao.xyz</code>)</li>
          </ul>
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
            <Row cells={['402', 'Payment required (x402 — see PAYMENT-REQUIRED header)']} />
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
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-foreground border-b border-border pb-2 mb-4">
        {title}
      </h2>
      {children}
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-background border border-border p-4 mt-2 overflow-x-auto">
      <code className="text-xs font-mono text-foreground whitespace-pre">{children}</code>
    </pre>
  )
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="bg-background border border-border p-4 mt-3">
      <div className="flex items-center gap-2">
        <span className="status-pill status-pill-accent text-[10px]">{method}</span>
        <code className="text-xs font-mono text-foreground">{path}</code>
      </div>
      <p className="text-xs text-foreground-secondary font-mono mt-1">{desc}</p>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-xs font-mono mt-2">
      <thead>
        <tr className="border-b border-border">
          {headers.map((h) => (
            <th key={h} className="text-left text-foreground-muted uppercase py-2 pr-4">{h}</th>
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
        <td key={i} className="text-foreground-secondary py-2 pr-4">{c}</td>
      ))}
    </tr>
  )
}
