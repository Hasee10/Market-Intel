import type { ClassifiedSourceFn, SourceFn } from '../types.js';
import { scrapeDaraz } from './daraz.js';
import { scrapeGoto } from './goto.js';
import { scrapeIshopping } from './ishopping.js';
import { scrapeMega } from './mega.js';
import { scrapeNaheed } from './naheed.js';
import { scrapePriceoye } from './priceoye.js';
import { scrapeSapphireonline } from './sapphireonline.js';
import { scrapeShophive } from './shophive.js';
import { scrapeShopperspk } from './shopperspk.js';
import { scrapeTelemart } from './telemart.js';
import { scrapeVmart } from './vmart.js';

// Plain HTTP sources - no browser automation needed. Sapphireonline.pk is
// Salesforce Commerce Cloud with no bot protection on plain fetch, and is a
// brand-monitoring source (single brand's own store, not a marketplace).
// Added 2026-08-03: mega (custom HTML), naheed (Magento, same markup family
// as ishopping/shophive), vmart (Shopify products.json, same shape telemart
// uses) and shopperspk (WooCommerce Store API). Every selector/endpoint was
// verified against a live fetch before being added - see each file's header.
export const HTTP_SOURCES: SourceFn[] = [
  scrapePriceoye,
  scrapeTelemart,
  scrapeShophive,
  scrapeSapphireonline,
  scrapeMega,
  scrapeNaheed,
  scrapeVmart,
  scrapeShopperspk,
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
// Empty since 2026-08-03: OLX was the only classifieds source and has been
// removed (src/sources/olx.ts deleted, OLX_CATEGORIES dropped from config and
// the workflow). Every request from GitHub's runner IPs came back 429 for
// weeks, including after pacing and exponential backoff were added, which
// pointed at a standing IP-level block rather than a rate limit politeness
// could fix - it was burning 20-30 minutes per run for zero rows.
//
// The classifieds *plumbing* around it is intentionally left in place: the
// RawClassifiedListing/ClassifiedSourceFn types, saveClassifiedListings() in
// db.ts, and the market_classified_* tables. Removing those would be a schema
// and pipeline change, and they are what any future classifieds source would
// plug into. The retailer coverage added the same day (naheed, shopperspk,
// mega, vmart) is the durable answer to the category gap OLX used to fill -
// see ROADMAP.md D4.
export const CLASSIFIED_SOURCES: ClassifiedSourceFn[] = [];
