import Link from 'next/link'

type DeveloperCTAProps = {
  exampleChain: number
  exampleAgentId: number
}

function CodeSnippet({
  chain,
  agentId,
}: {
  chain: number
  agentId: number
}) {
  return (
    <pre className="mt-8 rounded-lg border border-border bg-bg p-5 text-left text-sm font-mono leading-relaxed overflow-x-auto">
      <code>
        <span className="text-accent/70">const</span>
        <span className="text-text-primary"> ds </span>
        <span className="text-accent/70">=</span>
        <span className="text-text-primary"> </span>
        <span className="text-accent/70">new</span>
        <span className="text-text-primary"> </span>
        <span className="text-text-secondary">DenScope</span>
        <span className="text-text-muted">{'({ '}</span>
        <span className="text-text-primary">apiKey</span>
        <span className="text-text-muted">: </span>
        <span className="text-emerald-400/80">{`'ds_...'`}</span>
        <span className="text-text-muted">{' })'}</span>
        {'\n\n'}
        <span className="text-accent/70">const</span>
        <span className="text-text-primary"> result </span>
        <span className="text-accent/70">=</span>
        <span className="text-text-primary"> </span>
        <span className="text-accent/70">await</span>
        <span className="text-text-primary"> ds.</span>
        <span className="text-text-secondary">evaluate</span>
        <span className="text-text-muted">(</span>
        <span className="text-emerald-400/80">{chain}</span>
        <span className="text-text-muted">, </span>
        <span className="text-emerald-400/80">{agentId}</span>
        <span className="text-text-muted">, </span>
        <span className="text-text-muted">{'{ '}</span>
        <span className="text-text-primary">preset</span>
        <span className="text-text-muted">: </span>
        <span className="text-emerald-400/80">{`'default_safety'`}</span>
        <span className="text-text-muted">{' }'}</span>
        <span className="text-text-muted">)</span>
        {'\n\n'}
        <span className="text-accent/70">if</span>
        <span className="text-text-muted"> (</span>
        <span className="text-text-primary">result.evaluation.</span>
        <span className="text-text-secondary">recommended_action</span>
        <span className="text-accent/70"> === </span>
        <span className="text-emerald-400/80">{`'allow'`}</span>
        <span className="text-text-muted">) {'{'}</span>
        {'\n'}
        <span className="text-text-muted">{'  '}</span>
        <span className="text-emerald-400">{'// trusted — proceed with interaction'}</span>
        {'\n'}
        <span className="text-text-muted">{'}'}</span>
      </code>
    </pre>
  )
}

export function DeveloperCTA({ exampleChain, exampleAgentId }: DeveloperCTAProps) {
  return (
    <section className="px-6 py-14 md:py-20 bg-surface/50">
      <div className="mx-auto max-w-[720px] text-center">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Build with trust data
        </h2>
        <p className="mt-3 text-text-secondary max-w-[580px] mx-auto">
          Access trust scores, verification signals, and certificate-backed
          agent intelligence through a simple developer-facing API.
        </p>

        <CodeSnippet chain={exampleChain} agentId={exampleAgentId} />

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/docs/api"
            className="inline-flex h-10 items-center rounded-lg bg-accent px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            View API Docs
          </Link>
          <Link
            href={`/agent/${exampleChain}/${exampleAgentId}`}
            className="text-sm text-text-muted underline underline-offset-2 transition-colors hover:text-accent"
          >
            See example agent dossier →
          </Link>
        </div>
      </div>
    </section>
  )
}
