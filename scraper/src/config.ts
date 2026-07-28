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
  olxCategories: splitList(process.env.OLX_CATEGORIES) as string[],

  logLevel: process.env.LOG_LEVEL ?? 'info',
};

export function requireDatabase(): void {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).',
    );
  }
}
