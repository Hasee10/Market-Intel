import { AnnouncementBar } from '@/components/landing/AnnouncementBar';
import { AssistantWidget } from '@/components/landing/AssistantWidget';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { CompanyLogoSlider } from '@/components/landing/CompanyLogoSlider';
import { CTABanner } from '@/components/landing/CTABanner';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingHero } from '@/components/landing/LandingHero';
import { MarketplaceLogoSlider } from '@/components/landing/MarketplaceLogoSlider';
import { getShowcaseBrands, getShowcaseSellers } from '@/lib/market-intel/showcase';
import { StatsBar } from '@/components/landing/StatsBar';

// Public marketing page - `/` is not in middleware.ts's PROTECTED_PREFIXES,
// so this is reachable without signing in. Signed-in sellers land here too
// if they navigate to `/` directly; the header's "Get started"/"Sign in"
// buttons are the way in, same as any marketing site.
//
// Now async: the company/brand showcase (getShowcaseSellers/getShowcaseBrands)
// reads real data from Supabase via the anon client (createPublicClient, not
// cookie-bound), so this stays request-time-fetchable without forcing the
// whole page into per-request dynamic rendering. Both calls fail soft to []
// on any error, so a Supabase outage or migration 024 not yet being applied
// hides that one section instead of breaking the page.
export default async function Home() {
  const [showcaseSellers, showcaseBrands] = await Promise.all([getShowcaseSellers(), getShowcaseBrands()]);

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
      <MarketplaceLogoSlider />
      <CompanyLogoSlider sellers={showcaseSellers} brands={showcaseBrands} />
      <FeaturesSection />
      <ComparisonSection />
      <CTABanner />
      <LandingFooter />
      <AssistantWidget />
    </>
  );
}
