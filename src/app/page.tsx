import { HeroSection } from '@/components/landing/HeroSection'

export const revalidate = 300

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <HeroSection />
    </div>
  )
}
