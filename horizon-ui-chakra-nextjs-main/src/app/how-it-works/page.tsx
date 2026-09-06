import { AssistantWidget } from '@/components/landing/AssistantWidget';
import { CTABanner } from '@/components/landing/CTABanner';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { MarketLoopSection } from '@/components/landing/MarketLoopSection';
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
      <div className="flex min-h-dvh flex-col">
        <LandingHeader />
        <main className="flex-1">
          <HowItWorksSection />
          {/* The three steps above are the short answer to "how does this
              work"; this is the same answer as the cycle it actually is,
              which is the part that explains why it never finishes. Lives
              here rather than on the homepage: this is the page whose whole
              job is that question. */}
          <MarketLoopSection />
          <CTABanner />
        </main>
        <LandingFooter />
      </div>
      <AssistantWidget />
    </>
  );
}
