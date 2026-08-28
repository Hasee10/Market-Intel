import 'dotenv/config';

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const config = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',

  cloakbrowserLicenseKey: process.env.CLOAKBROWSER_LICENSE_KEY || undefined,
  scraperProxy: process.env.SCRAPER_PROXY || undefined,

  priceoyeCategories: splitList(process.env.PRICEOYE_CATEGORIES) as string[],
  telemartCollections: splitList(process.env.TELEMART_COLLECTIONS) as string[],
  shophiveCategories: splitList(process.env.SHOPHIVE_CATEGORIES) as string[],
  ishoppingCategories: splitList(process.env.ISHOPPING_CATEGORIES) as string[],
  gotoCategories: splitList(process.env.GOTO_CATEGORIES) as string[],
  sapphireonlineCategories: splitList(process.env.SAPPHIREONLINE_CATEGORIES) as string[],
  darazCategories: splitList(process.env.DARAZ_CATEGORIES) as string[],

  // Added 2026-08-03 (coverage expansion). Naheed and ShoppersPK are the ones
  // that matter most: they are the first sources with real depth in grocery,
  // beauty, home and kids - the seller categories left with no retailer
  // coverage once OLX was disabled.
  megaCategories: splitList(process.env.MEGA_CATEGORIES) as string[],
  naheedCategories: splitList(process.env.NAHEED_CATEGORIES) as string[],
  vmartCollections: splitList(process.env.VMART_COLLECTIONS) as string[],
  shopperspkCategories: splitList(process.env.SHOPPERSPK_CATEGORIES) as string[],

  logLevel: process.env.LOG_LEVEL ?? 'info',

  // Review scraper (scraper/src/reviews/) - a separate job/workflow from the
  // main listing scrape. Caps how many products get their reviews (re-)
  // scraped in one run, so full-catalog coverage builds up incrementally
  // across scheduled runs instead of one massive request-volume spike
  // against a site that already rate-limits (the same failure mode that got
  // OLX IP-blocked). Default kept small deliberately - raise once a real run
  // has been observed to behave.
  reviewScrapeBatchSize: Number(process.env.REVIEW_SCRAPE_BATCH_SIZE) || 250,
};

export function requireDatabase(): void {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).',
    );
  }
}
