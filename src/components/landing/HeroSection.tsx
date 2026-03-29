import { ScoreLookup } from './ScoreLookup'

type ExampleAgent = { chainId: number; agentId: number }

type HeroSectionProps = {
  exampleAgents: ExampleAgent[]
}

export function HeroSection({ exampleAgents }: HeroSectionProps) {
  return (
    <section className="flex flex-col items-center text-center px-6 pt-[72px] pb-14 md:pt-[100px] md:pb-[76px]">
      <h1 className="font-display text-[28px] md:text-[40px] font-bold text-text-primary tracking-[-0.02em] max-w-[600px]">
        Trust infrastructure for autonomous agents
      </h1>
      <p className="mt-4 text-lg text-text-secondary max-w-[590px]">
        Compute trust signals, verify agent behavior, and expose the results
        through APIs and certificates.
      </p>
      <ScoreLookup exampleAgents={exampleAgents} />
    </section>
  )
}
