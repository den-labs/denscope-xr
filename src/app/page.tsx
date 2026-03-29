import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturedCertificates } from '@/components/landing/FeaturedCertificates'
import { DeveloperCTA } from '@/components/landing/DeveloperCTA'
import { fetchFeaturedCertificates } from '@/lib/supabase/featured-certificates'

export const revalidate = 300

const EXAMPLE_AGENTS = [
  { chainId: 42220, agentId: 5 },
  { chainId: 1187947933, agentId: 1 },
]

export default async function LandingPage() {
  const { topScore, recent } = await fetchFeaturedCertificates()

  return (
    <div className="flex flex-col overflow-y-auto h-full">
      <HeroSection exampleAgents={EXAMPLE_AGENTS} />
      <FeaturedCertificates topScore={topScore} recent={recent} />
      <DeveloperCTA
        exampleChain={EXAMPLE_AGENTS[0].chainId}
        exampleAgentId={EXAMPLE_AGENTS[0].agentId}
      />
    </div>
  )
}
