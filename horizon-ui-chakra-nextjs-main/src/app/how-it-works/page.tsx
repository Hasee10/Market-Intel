import { AssistantWidget } from '@/components/landing/AssistantWidget';
import { CTABanner } from '@/components/landing/CTABanner';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';

// Was an anchor section on the homepage, now its own route so it can be
// linked/shared/indexed on its own, same as pricing's promotion off the
// homepage.
export default function HowItWorksPage() {
  return (
    <>
      <title>How it works | Ryvl</title>
      <meta
        name="description"
        content="From signup to your first insight - how Ryvl tracks the market for you and turns it into action."
      />
      <LandingHeader />
      <HowItWorksSection />
      <CTABanner />
      <LandingFooter />
      <AssistantWidget />
    </>
  );
}
