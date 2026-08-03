import type { ClassifiedSourceFn, SourceFn } from '../types.js';
import { scrapeDaraz } from './daraz.js';
import { scrapeGoto } from './goto.js';
import { scrapeIshopping } from './ishopping.js';
import { scrapeOlx } from './olx.js';
import { scrapePriceoye } from './priceoye.js';
import { scrapeSapphireonline } from './sapphireonline.js';
import { scrapeShophive } from './shophive.js';
import { scrapeTelemart } from './telemart.js';

// Plain HTTP sources - no browser automation needed. Sapphireonline.pk is
// Salesforce Commerce Cloud with no bot protection on plain fetch, and is a
// brand-monitoring source (single brand's own store, not a marketplace).
// Daraz is here despite being the hardest site: its category pages render
// client-side, but `?ajax=true` returns the page's JSON model over plain
// fetch, so no browser is needed. See daraz.ts if that ever changes.
// Daraz runs last because it is the slowest (rate-limited, paginated) and a
// failure there should not delay the cheap sources.
export const HTTP_SOURCES: SourceFn[] = [
  scrapePriceoye,
  scrapeTelemart,
  scrapeShophive,
  scrapeSapphireonline,
  scrapeDaraz,
];

// Browser-automation sources (CloakBrowser) - for sites that block plain HTTP
// or need real TLS/session handling. iShopping.pk sits behind Cloudflare
// (Cf-Mitigated: challenge on plain fetch). Goto.com.pk has an expired TLS
// cert (needs ignoreHTTPSErrors) and thin/inconsistent category inventory -
// see scrapeGoto's category list.
export const BROWSER_SOURCES: SourceFn[] = [scrapeIshopping, scrapeGoto];

// Classifieds sources - write to market_classified_listings instead of
// market_products, see types.ts / migrations/007.
export const CLASSIFIED_SOURCES: ClassifiedSourceFn[] = [scrapeOlx];
