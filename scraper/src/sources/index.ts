import type { ClassifiedSourceFn, SourceFn } from '../types.js';
import { scrapeDaraz } from './daraz.js';
import { scrapeGoto } from './goto.js';
import { scrapeIshopping } from './ishopping.js';
import { scrapePriceoye } from './priceoye.js';
import { scrapeSapphireonline } from './sapphireonline.js';
import { scrapeShophive } from './shophive.js';
import { scrapeTelemart } from './telemart.js';

// Plain HTTP sources - no browser automation needed. Sapphireonline.pk is
// Salesforce Commerce Cloud with no bot protection on plain fetch, and is a
// brand-monitoring source (single brand's own store, not a marketplace).
export const HTTP_SOURCES: SourceFn[] = [
  scrapePriceoye,
  scrapeTelemart,
  scrapeShophive,
  scrapeSapphireonline,
];

// Browser-automation sources (CloakBrowser) - for sites that block plain HTTP
// or need real TLS/session handling. iShopping.pk sits behind Cloudflare
// (Cf-Mitigated: challenge on plain fetch). Goto.com.pk has an expired TLS
// cert (needs ignoreHTTPSErrors) and thin/inconsistent category inventory -
// see scrapeGoto's category list. Daraz's `?ajax=true` category endpoint
// technically needs no browser to parse, but started answering some
// requests with a challenge/HTML page under sustained plain-HTTP load, so it
// is driven through CloakBrowser too - see daraz.ts. It runs last because it
// is the slowest (rate-limited, paginated, ~22 categories) and a failure
// there should not delay the cheap sources.
export const BROWSER_SOURCES: SourceFn[] = [scrapeIshopping, scrapeGoto, scrapeDaraz];

// Classifieds sources - write to market_classified_listings instead of
// market_products, see types.ts / migrations/007.
//
// OLX is disabled here (2026-08-03), not deleted: every request from
// GitHub's runner IPs has come back 429 for weeks (ROADMAP.md D4), including
// after adding pacing + exponential backoff on 429 - so this looks like a
// standing IP-level block on that IP range, not a transient rate limit that
// politeness can fix. Leaving it retry indefinitely was burning 20-30+
// minutes of every scrape run for zero rows and risked the whole job being
// killed by the workflow timeout before the other 7 sources even got a
// chance to fail cleanly. scrapeOlx() itself is untouched and still works
// from a non-blocked IP (e.g. a residential proxy) - re-add it to this array
// once D4's real fix (proxy or additional retailer coverage) lands.
export const CLASSIFIED_SOURCES: ClassifiedSourceFn[] = [];
