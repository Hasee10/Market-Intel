import { AssistantWidget } from '@/components/landing/AssistantWidget';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { PricingPageBanner } from '@/components/landing/PricingPageBanner';
import { PricingSection } from '@/components/landing/PricingSection';

// Dedicated pricing page - was an anchor section on the homepage, now its
// own route so it can be linked/shared/indexed on its own and doesn't force
// every homepage visitor to scroll past it.
export default function PricingPage() {
  return (
    <>
      <title>Pricing | Ryvl</title>
      <meta name="description" content="Simple, honest pricing for Ryvl - free, paid, and premium tiers." />
      <div className="flex min-h-dvh flex-col">
        <LandingHeader />
        <main className="flex-1">
          <PricingPageBanner />
          <PricingSection />
        </main>
        <LandingFooter />
      </div>
      <AssistantWidget />
    </>
  );
}
