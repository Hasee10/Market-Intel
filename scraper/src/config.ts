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

  // Added 2026-08-29 - all 5 are Shopify storefronts (see sources/shopify-
  // source.ts), verified live before being added. Khaadi was evaluated and
  // rejected: its robots.txt disallows /women/, which covers essentially
  // its whole catalog.
  bagalleryCollections: splitList(process.env.BAGALLERY_COLLECTIONS) as string[],
  junaidjamshedCollections: splitList(process.env.JUNAIDJAMSHED_COLLECTIONS) as string[],
  gulahmedCollections: splitList(process.env.GULAHMED_COLLECTIONS) as string[],
  chasevalueCollections: splitList(process.env.CHASEVALUE_COLLECTIONS) as string[],
  alfatahCollections: splitList(process.env.ALFATAH_COLLECTIONS) as string[],

  // Added 2026-08-29, second batch. Springs/Outfitters/SEW Markaz are
  // Shopify (reuse the same factory as the batch above). Petshub is
  // WooCommerce Store API, mirroring shopperspk.ts. Fills grocery/pantry,
  // household, kids fashion and pet-supplies gaps. Symbios.pk (dead/
  // misconfigured host) and METRO Pakistan (hard 403 bot block) were
  // evaluated and rejected; Homeshopping.pk (VTEX headless) and Idealancy.pk
  // (custom platform, JSON-LD only) are real stores but need dedicated
  // integration work, deferred rather than rushed.
  springsCollections: splitList(process.env.SPRINGS_COLLECTIONS) as string[],
  outfittersCollections: splitList(process.env.OUTFITTERS_COLLECTIONS) as string[],
  sewmarkazCollections: splitList(process.env.SEWMARKAZ_COLLECTIONS) as string[],
  petshubCategories: splitList(process.env.PETSHUB_CATEGORIES) as string[],

  // Added 2026-08-29, third batch. Zellbury/Bonanza Satrangi/Beechtree/
  // Nishat Linen (fashion) + Interwood/Habitt/Poshish/Woods (furniture) +
  // ChenOne (apparel + home textile) are all Shopify (same factory).
  // Petfit.pk and Luminaria.pk are WooCommerce Store API, sharing a new
  // factory (woocommerce-source.ts) since two more near-identical files were
  // being added in this same batch. Fills furniture and home-decor gaps.
  // Ethnic/Highfy/Malabis were evaluated and rejected - every domain variant
  // resolved to a parked or unrelated page, not a real store. Nested.pk is a
  // real store but a heavily client-rendered SPA (Vue "Materio" template)
  // with no server-rendered product data - deferred, needs its backend API
  // reverse-engineered separately, same bucket as Homeshopping.pk/
  // Idealancy.pk above.
  zellburyCollections: splitList(process.env.ZELLBURY_COLLECTIONS) as string[],
  bonanzasatrangiCollections: splitList(process.env.BONANZASATRANGI_COLLECTIONS) as string[],
  beechtreeCollections: splitList(process.env.BEECHTREE_COLLECTIONS) as string[],
  nishatlinenCollections: splitList(process.env.NISHATLINEN_COLLECTIONS) as string[],
  interwoodCollections: splitList(process.env.INTERWOOD_COLLECTIONS) as string[],
  habittCollections: splitList(process.env.HABITT_COLLECTIONS) as string[],
  poshishCollections: splitList(process.env.POSHISH_COLLECTIONS) as string[],
  woodsCollections: splitList(process.env.WOODS_COLLECTIONS) as string[],
  chenoneCollections: splitList(process.env.CHENONE_COLLECTIONS) as string[],
  petfitCategories: splitList(process.env.PETFIT_CATEGORIES) as string[],
  luminariaCategories: splitList(process.env.LUMINARIA_CATEGORIES) as string[],

  // Added 2026-08-29, fourth batch - targeting Sports & Outdoors, the
  // weakest-covered category (2 sources before this). Alisports/Bodybrics/
  // HustlersOnlyPK/ActivitySphere are Shopify (same factory). Zeesol Store
  // is WooCommerce Store API (same factory as petfit/luminaria) - BUT its
  // Store API only accepts numeric category IDs, not slugs, unlike every
  // other WooCommerce source added so far (confirmed live: the slug filter
  // returns an empty array despite the category genuinely having 124
  // products; the numeric ID works). Config values below are IDs for
  // zeesol, slugs for everything else - the factory doesn't care which,
  // it just passes the string through. TheSportStore.pk was evaluated and
  // deferred: it's a real, live site, but runs OpenCart with no standard
  // product-feed endpoint (no /collections.json, no WooCommerce Store
  // API) - needs a bespoke HTML/JSON-LD source file, same bucket as
  // Idealancy.pk/Homeshopping.pk above.
  alisportsCollections: splitList(process.env.ALISPORTS_COLLECTIONS) as string[],
  bodybricsCollections: splitList(process.env.BODYBRICS_COLLECTIONS) as string[],
  hustlersonlypkCollections: splitList(process.env.HUSTLERSONLYPK_COLLECTIONS) as string[],
  activitysphereCollections: splitList(process.env.ACTIVITYSPHERE_COLLECTIONS) as string[],
  zeesolCategories: splitList(process.env.ZEESOL_CATEGORIES) as string[],

  // Added 2026-08-29, fifth batch - Books & Stationery, Automotive, Coffee &
  // Beverages, closing out the same brief the Sports & Outdoors batch
  // started (weak/critical-gap categories). BlingSpot/Katib/Mercury
  // Stationery (books/stationery), SehgalMotors/AsadAutos/PakistanMotors/
  // PremiumExo (automotive) and CoffeeCrest/Snapcart (coffee/beverages) are
  // all Shopify. Stationery.pk, Assany.pk and Autostore.pk are WooCommerce
  // Store API, slugs work fine on all three (unlike Zeesol above).
  // Waqarmart.pk was evaluated and deferred: real site, but a custom
  // Laravel-based platform (not WordPress despite having a /wp-json/ path -
  // that's just a same-page redirect, the real response is a Laravel/Blade
  // app), no standard product-feed endpoint, same bucket as
  // Idealancy.pk/TheSportStore.pk above. Snapcart.pk is a large general
  // marketplace (100k+ products across pharmacy/beauty/groceries too), but
  // has a genuine, substantial Tea & Coffee category (916 products) -
  // included for that segment specifically, not as a general marketplace.
  blingspotCollections: splitList(process.env.BLINGSPOT_COLLECTIONS) as string[],
  katibCollections: splitList(process.env.KATIB_COLLECTIONS) as string[],
  mercurystationeryCollections: splitList(process.env.MERCURYSTATIONERY_COLLECTIONS) as string[],
  stationarypkCategories: splitList(process.env.STATIONARYPK_CATEGORIES) as string[],
  assanyCategories: splitList(process.env.ASSANY_CATEGORIES) as string[],
  sehgalmotorsCollections: splitList(process.env.SEHGALMOTORS_COLLECTIONS) as string[],
  asadautosCollections: splitList(process.env.ASADAUTOS_COLLECTIONS) as string[],
  pakistanmotorsCollections: splitList(process.env.PAKISTANMOTORS_COLLECTIONS) as string[],
  premiumexoCollections: splitList(process.env.PREMIUMEXO_COLLECTIONS) as string[],
  autostorepkCategories: splitList(process.env.AUTOSTOREPK_CATEGORIES) as string[],
  coffeecrestCollections: splitList(process.env.COFFEECREST_COLLECTIONS) as string[],
  snapcartCollections: splitList(process.env.SNAPCART_COLLECTIONS) as string[],

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
