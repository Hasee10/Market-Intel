import { AnnouncementBar } from '@/components/landing/AnnouncementBar';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { CTABanner } from '@/components/landing/CTABanner';
import { FaqSection } from '@/components/landing/FaqSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { StatsBar } from '@/components/landing/StatsBar';

// Public marketing page - `/` is not in middleware.ts's PROTECTED_PREFIXES,
// so this is reachable without signing in. Signed-in sellers land here too
// if they navigate to `/` directly; the header's "Get started"/"Sign in"
// buttons are the way in, same as any marketing site.
export default function Home() {
  return (
    <>
      <title>Ryvl - Market Intelligence for Online Sellers</title>
      <meta
        name="description"
        content="Competitive pricing benchmarks, peer comparisons, and demand signals for online sellers."
      />
      <AnnouncementBar />
      <LandingHeader />
      <LandingHero />
      <StatsBar />
      <FeaturesSection />
      <ComparisonSection />
      <FaqSection />
      <CTABanner />
      <LandingFooter />
    </>
  );
}
