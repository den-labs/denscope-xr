import { HeroSection } from '@/components/landing/HeroSection'
import { FeaturedCertificates } from '@/components/landing/FeaturedCertificates'
import { fetchFeaturedCertificates } from '@/lib/supabase/featured-certificates'

export const revalidate = 300

export default async function LandingPage() {
  const { topScore, recent } = await fetchFeaturedCertificates()

  return (
    <div className="flex flex-col">
      <HeroSection />
      <FeaturedCertificates topScore={topScore} recent={recent} />
    </div>
  )
}
