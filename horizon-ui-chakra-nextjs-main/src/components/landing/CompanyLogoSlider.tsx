import type { ShowcaseBrand, ShowcaseSeller } from '@/lib/market-intel/showcase';
import { LogoMarquee } from '@/components/landing/LogoMarquee';

// Renders the sellers + brands fetched server-side by page.tsx (see
// getShowcaseSellers/getShowcaseBrands in lib/market-intel/showcase.ts).
// No data fetching here - this stays a plain component so it can be handed
// props from an async Server Component without itself needing 'use client'.
//
// Sellers get a real logo.dev lookup: they opted in via Settings and
// supplied their own domain, so this is their own logo, with their consent.
// Brands never get a domain here, on purpose - LogoTile renders anything
// without a domain as a text pill instead of fetching a trademark logo we
// have no rights to (Samsung, Nike, etc. never agreed to appear on this
// site). If a future task wants real brand logos, that needs a real domain
// source AND a legal decision, not just wiring one up.
export function CompanyLogoSlider({ sellers, brands }: { sellers: ShowcaseSeller[]; brands: ShowcaseBrand[] }) {
  const items = [
    ...sellers.map((s) => ({ key: `seller-${s.domain}`, name: s.name, domain: s.domain })),
    ...brands.map((b) => ({ key: `brand-${b.name}`, name: b.name })),
  ];

  return <LogoMarquee label="Real sellers on Ryvl, alongside brands we already track pricing for" items={items} durationSeconds={32} />;
}

export default CompanyLogoSlider;
