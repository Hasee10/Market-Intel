import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingThemeLock } from '@/components/landing/LandingThemeLock';
import { PricingPageBanner } from '@/components/landing/PricingPageBanner';
import { PricingSection } from '@/components/landing/PricingSection';
import { TrustSection } from '@/components/landing/TrustSection';

// Dedicated pricing page - was an anchor section on the homepage, now its
// own route so it can be linked/shared/indexed on its own and doesn't force
// every homepage visitor to scroll past it.
export default function PricingPage() {
  return (
    <>
      <title>Pricing | Ryvl</title>
      <meta name="description" content="Simple, honest pricing for Ryvl - free, paid, and premium tiers." />
      <LandingThemeLock>
        <LandingHeader />
        <PricingPageBanner />
        <PricingSection />
        <TrustSection />
        <LandingFooter />
      </LandingThemeLock>
    </>
  );
}
