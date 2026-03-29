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
  const url = `https://denscope.vercel.app/api/v1/agent/${chain}/${agentId}/score`

  return (
    <pre className="mt-8 rounded-lg border border-border bg-bg p-5 text-left text-sm font-mono leading-relaxed overflow-x-auto">
      <code>
        <span className="text-accent/70">const</span>
        <span className="text-text-primary"> res </span>
        <span className="text-accent/70">=</span>
        <span className="text-text-primary"> </span>
        <span className="text-accent/70">await</span>
        <span className="text-text-primary"> </span>
        <span className="text-text-secondary">fetch</span>
        <span className="text-text-muted">(</span>
        {'\n'}
        <span className="text-text-muted">{'  '}</span>
        <span className="text-emerald-400/80">{`'${url}'`}</span>
        {'\n'}
        <span className="text-text-muted">)</span>
        {'\n'}
        <span className="text-accent/70">const</span>
        <span className="text-text-primary"> {'{ '}</span>
        <span className="text-text-primary">score</span>
        <span className="text-text-primary">{' }'}</span>
        <span className="text-accent/70"> =</span>
        <span className="text-text-primary"> </span>
        <span className="text-accent/70">await</span>
        <span className="text-text-primary"> res.</span>
        <span className="text-text-secondary">json</span>
        <span className="text-text-muted">()</span>
        {'\n'}
        <span className="text-text-muted/60">
          {'// score.value, score.confidence, score.breakdown'}
        </span>
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
