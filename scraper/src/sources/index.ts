import { config } from '../config.js';
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
import { scrapePetshub } from './petshub.js';
import { createShopifySource } from './shopify-source.js';
import { createWooCommerceSource } from './woocommerce-source.js';

// Added 2026-08-29 - all 5 verified live as Shopify storefronts before being
// added (robots.txt allows /collections/*/products.json, and that endpoint
// returns real product data on every one of them - see shopify-source.ts's
// header). Khaadi was evaluated from the same target list and rejected:
// robots.txt disallows /women/, which is essentially its whole catalog.
export const scrapeBagallery = createShopifySource({
  platformSlug: 'bagallery',
  baseUrl: 'https://bagallery.com',
  getCollections: () => config.bagalleryCollections,
});
export const scrapeJunaidjamshed = createShopifySource({
  platformSlug: 'junaidjamshed',
  baseUrl: 'https://www.junaidjamshed.com',
  getCollections: () => config.junaidjamshedCollections,
});
export const scrapeGulahmed = createShopifySource({
  platformSlug: 'gulahmed',
  baseUrl: 'https://www.gulahmedshop.com',
  getCollections: () => config.gulahmedCollections,
});
export const scrapeChasevalue = createShopifySource({
  platformSlug: 'chasevalue',
  baseUrl: 'https://chasevalue.pk',
  getCollections: () => config.chasevalueCollections,
});
export const scrapeAlfatah = createShopifySource({
  platformSlug: 'alfatah',
  baseUrl: 'https://alfatah.pk',
  getCollections: () => config.alfatahCollections,
});

// Added 2026-08-29, second batch - Springs, Outfitters, SEW Markaz are
// Shopify (same factory); Petshub.pk is WooCommerce Store API (see
// petshub.ts). Fills grocery/pantry, kids fashion, home-decor and
// pet-supplies gaps. See config.ts for what was evaluated and rejected
// from the same candidate list (Symbios.pk, METRO) or deferred
// (Homeshopping.pk, Idealancy.pk).
export const scrapeSprings = createShopifySource({
  platformSlug: 'springs',
  baseUrl: 'https://springs.com.pk',
  getCollections: () => config.springsCollections,
});
export const scrapeOutfitters = createShopifySource({
  platformSlug: 'outfitters',
  baseUrl: 'https://outfitters.com.pk',
  getCollections: () => config.outfittersCollections,
});
export const scrapeSewmarkaz = createShopifySource({
  platformSlug: 'sewmarkaz',
  baseUrl: 'https://www.sewmarkaz.com',
  getCollections: () => config.sewmarkazCollections,
});

// Added 2026-08-29, third batch - fashion (Zellbury, Bonanza Satrangi,
// Beechtree, Nishat Linen) + furniture/home (Interwood, Habitt, Poshish,
// Woods, ChenOne) are all Shopify (same factory). Petfit.pk and
// Luminaria.pk are WooCommerce Store API (see woocommerce-source.ts). See
// config.ts for what was evaluated and rejected (Ethnic, Highfy, Malabis -
// all parked/unrelated domains) or deferred (Nested.pk - real store, but a
// client-rendered SPA with no server-rendered product data).
export const scrapeZellbury = createShopifySource({
  platformSlug: 'zellbury',
  baseUrl: 'https://zellbury.com',
  getCollections: () => config.zellburyCollections,
});
export const scrapeBonanzasatrangi = createShopifySource({
  platformSlug: 'bonanzasatrangi',
  baseUrl: 'https://bonanzasatrangi.com',
  getCollections: () => config.bonanzasatrangiCollections,
});
export const scrapeBeechtree = createShopifySource({
  platformSlug: 'beechtree',
  baseUrl: 'https://beechtree.pk',
  getCollections: () => config.beechtreeCollections,
});
export const scrapeNishatlinen = createShopifySource({
  platformSlug: 'nishatlinen',
  baseUrl: 'https://nishatlinen.com',
  getCollections: () => config.nishatlinenCollections,
});
export const scrapeInterwood = createShopifySource({
  platformSlug: 'interwood',
  baseUrl: 'https://interwood.pk',
  getCollections: () => config.interwoodCollections,
});
export const scrapeHabitt = createShopifySource({
  platformSlug: 'habitt',
  baseUrl: 'https://habitt.com',
  getCollections: () => config.habittCollections,
});
export const scrapePoshish = createShopifySource({
  platformSlug: 'poshish',
  baseUrl: 'https://poshish.pk',
  getCollections: () => config.poshishCollections,
});
export const scrapeWoods = createShopifySource({
  platformSlug: 'woods',
  baseUrl: 'https://woods.pk',
  getCollections: () => config.woodsCollections,
});
export const scrapeChenone = createShopifySource({
  platformSlug: 'chenone',
  baseUrl: 'https://chenone.com',
  getCollections: () => config.chenoneCollections,
});
export const scrapePetfit = createWooCommerceSource({
  platformSlug: 'petfit',
  baseUrl: 'https://petfit.pk',
  getCategories: () => config.petfitCategories,
});
export const scrapeLuminaria = createWooCommerceSource({
  platformSlug: 'luminaria',
  baseUrl: 'https://luminaria.pk',
  getCategories: () => config.luminariaCategories,
});

// Added 2026-08-29, fourth batch - targeting Sports & Outdoors, the
// weakest-covered category before this (2 sources). Alisports/Bodybrics/
// HustlersOnlyPK/ActivitySphere are Shopify (same factory). Zeesol Store is
// WooCommerce Store API - see config.ts for why its config values are
// numeric category IDs, not slugs like every other WooCommerce source here.
export const scrapeAlisports = createShopifySource({
  platformSlug: 'alisports',
  baseUrl: 'https://www.alisports.pk',
  getCollections: () => config.alisportsCollections,
});
export const scrapeBodybrics = createShopifySource({
  platformSlug: 'bodybrics',
  baseUrl: 'https://bodybrics.com',
  getCollections: () => config.bodybricsCollections,
});
export const scrapeHustlersonlypk = createShopifySource({
  platformSlug: 'hustlersonlypk',
  baseUrl: 'https://hustlersonlypk.com',
  getCollections: () => config.hustlersonlypkCollections,
});
export const scrapeActivitysphere = createShopifySource({
  platformSlug: 'activitysphere',
  baseUrl: 'https://activitysphere.pk',
  getCollections: () => config.activitysphereCollections,
});
export const scrapeZeesol = createWooCommerceSource({
  platformSlug: 'zeesol',
  baseUrl: 'https://www.zeesol.net',
  getCategories: () => config.zeesolCategories,
});

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
  scrapeBagallery,
  scrapeJunaidjamshed,
  scrapeGulahmed,
  scrapeChasevalue,
  scrapeAlfatah,
  scrapeSprings,
  scrapeOutfitters,
  scrapeSewmarkaz,
  scrapePetshub,
  scrapeZellbury,
  scrapeBonanzasatrangi,
  scrapeBeechtree,
  scrapeNishatlinen,
  scrapeInterwood,
  scrapeHabitt,
  scrapePoshish,
  scrapeWoods,
  scrapeChenone,
  scrapePetfit,
  scrapeLuminaria,
  scrapeAlisports,
  scrapeBodybrics,
  scrapeHustlersonlypk,
  scrapeActivitysphere,
  scrapeZeesol,
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
