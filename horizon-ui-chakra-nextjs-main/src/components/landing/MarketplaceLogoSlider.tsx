'use client';

import { MARKETPLACES } from '@/lib/marketplaces';
import { LogoMarquee } from '@/components/landing/LogoMarquee';

// Real logos of the marketplaces Ryvl actually scrapes - not customer/user
// logos. There is no public user base to cite yet (see StatsBar's note on
// the same problem), so this is deliberately framed as "who we track," which
// is true today, rather than "who trusts us," which would not be.
//
// Logos come from logo.dev's img API (https://img.logo.dev/<domain>) using
// the publishable token in NEXT_PUBLIC_LOGO_DEV_TOKEN - that key is designed
// to be embedded client-side (it only ever appears in an <img src>, same as
// logo.dev's own docs), unlike the secret key, which is server-only and not
// used by this component. See LogoTile/LogoMarquee for the shared rendering
// this now shares with CompanyLogoSlider.
export function MarketplaceLogoSlider() {
  const items = MARKETPLACES.map((m) => ({ key: m.domain, name: m.name, domain: m.domain }));

  return <LogoMarquee label={`Pricing tracked live across ${MARKETPLACES.length} marketplaces`} items={items} />;
}

export default MarketplaceLogoSlider;
