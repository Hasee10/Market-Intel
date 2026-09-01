import { AssistantWidget } from '@/components/landing/AssistantWidget';
import { CTABanner } from '@/components/landing/CTABanner';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { TrustSection } from '@/components/landing/TrustSection';

// Was an anchor section on the homepage, now its own route so it can be
// linked/shared/indexed on its own, same as pricing's promotion off the
// homepage. TrustSection is still reused as-is on /pricing (right above the
// pricing table, where "what do I get for this" and "is my data safe" sit
// together) - this page is the other place it's linked from.
export default function TrustPage() {
  return (
    <>
      <title>Peer benchmarking, not surveillance | Ryvl</title>
      <meta
        name="description"
        content="Nothing private about a competitor's business is ever shown on Ryvl - here's exactly how that works."
      />
      <LandingHeader />
      <TrustSection />
      {/* After the three privacy guarantees, before the CTA: the claims land
          first, then sellers saying those claims were what convinced them. */}
      <TestimonialsSection />
      <CTABanner />
      <LandingFooter />
      <AssistantWidget />
    </>
  );
}
