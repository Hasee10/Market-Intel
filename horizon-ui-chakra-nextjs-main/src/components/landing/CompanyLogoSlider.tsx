import type { ShowcaseBrand, ShowcaseSeller } from '@/lib/market-intel/showcase';
import { LogoMarquee } from '@/components/landing/LogoMarquee';

// Renders the sellers + brands fetched server-side by page.tsx (see
// getShowcaseSellers/getShowcaseBrands in lib/market-intel/showcase.ts).
// No data fetching here - this stays a plain component so it can be handed
// props from an async Server Component without itself needing 'use client'.
//
// Both sellers and brands get a real logo.dev logo attempt here: sellers via
// their own opted-in domain, brands via a per-name logo.dev Brand Search
// lookup (showcase.ts) since scraped listings never stored a brand's
// domain. Showing real brand logos (Samsung, Nike, ...) rather than text-only
// pills was an explicit, flagged product decision accepting the
// trademark/endorsement-implication risk - if that ever needs walking back,
// the fix is dropping `domain` on the brand mapping below, not touching
// LogoTile (it already falls back to an initials avatar whenever a domain
// is absent or its image fails to load).
//
// Scrolls the opposite direction from MarketplaceLogoSlider (right instead
// of left) so the two rows read as distinct rather than one long repeat.
export function CompanyLogoSlider({ sellers, brands }: { sellers: ShowcaseSeller[]; brands: ShowcaseBrand[] }) {
  const items = [
    ...sellers.map((s) => ({ key: `seller-${s.domain}`, name: s.name, domain: s.domain })),
    ...brands.map((b) => ({ key: `brand-${b.name}`, name: b.name, domain: b.domain ?? undefined })),
  ];

  return (
    <LogoMarquee
      label="Real sellers on Ryvl, alongside brands we already track pricing for"
      items={items}
      durationSeconds={32}
      direction="right"
    />
  );
}

export default CompanyLogoSlider;
