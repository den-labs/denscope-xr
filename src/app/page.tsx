import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturedCertificates } from '@/components/landing/FeaturedCertificates'
import { DeveloperCTA } from '@/components/landing/DeveloperCTA'
import { fetchFeaturedCertificates } from '@/lib/supabase/featured-certificates'

export const revalidate = 300

const EXAMPLE_CHAIN = 42220
const EXAMPLE_AGENT_ID = 5

export default async function LandingPage() {
  const { topScore, recent } = await fetchFeaturedCertificates()

  return (
    <div className="flex flex-col">
      <HeroSection
        exampleChain={EXAMPLE_CHAIN}
        exampleAgentId={EXAMPLE_AGENT_ID}
      />
      <FeaturedCertificates topScore={topScore} recent={recent} />
      <DeveloperCTA
        exampleChain={EXAMPLE_CHAIN}
        exampleAgentId={EXAMPLE_AGENT_ID}
      />
    </div>
  )
}
