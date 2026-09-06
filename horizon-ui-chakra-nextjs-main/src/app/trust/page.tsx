import { AssistantWidget } from '@/components/landing/AssistantWidget';
import { CTABanner } from '@/components/landing/CTABanner';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { TrustSection } from '@/components/landing/TrustSection';

// Was an anchor section on the homepage, now its own route so it can be
// linked/shared/indexed on its own, same as pricing's promotion off the
// homepage. This is now the only place TrustSection renders - it used to sit
// on /pricing as well, above the pricing table, and was removed from there.
export default function TrustPage() {
  return (
    <>
      <title>Peer benchmarking, not surveillance | Ryvl</title>
      <meta
        name="description"
        content="Nothing private about a competitor's business is ever shown on Ryvl - here's exactly how that works."
      />
      <div className="flex min-h-dvh flex-col">
        <LandingHeader />
        <main className="flex-1">
          <TrustSection />
          {/* After the three privacy guarantees, before the CTA: the claims land
              first, then sellers saying those claims were what convinced them. */}
          <TestimonialsSection />
          <CTABanner />
        </main>
        <LandingFooter />
      </div>
      <AssistantWidget />
    </>
  );
}
