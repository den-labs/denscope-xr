import Link from 'next/link'

type DeveloperCTAProps = {
  exampleChain: number
  exampleAgentId: number
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

        <pre className="mt-8 rounded-lg border border-border bg-bg p-4 text-left text-sm font-mono text-text-secondary overflow-x-auto">
          <code>{`const res = await fetch(
  'https://denscope.vercel.app/api/v1/agent/${exampleChain}/${exampleAgentId}/score'
)
const { score } = await res.json()
// score.value, score.confidence, score.breakdown`}</code>
        </pre>

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
