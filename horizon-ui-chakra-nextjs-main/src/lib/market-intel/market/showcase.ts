'server-only';

import { unstable_cache } from 'next/cache';

import { createPublicClient } from '@/lib/supabase/server';
import { sanitizeDomain } from '@/lib/domain';
import { searchBrandDomain } from '@/lib/logo-dev';

// Data for the public marketing homepage's company slider (see
// components/landing/CompanyLogoSlider.tsx). Two sources, deliberately kept
// separate rather than merged into one query:
//
//   - Real sellers who opted in via Settings > "Show my logo on the Ryvl
//     site" (seller_marketing_showcase view, migration 024). Genuine
//     customers, genuine consent - the domain is theirs, entered by them.
//   - Brands actually present in scraped market_products (top_market_brands
//     RPC, migration 024). These are third parties with no relationship or
//     consent - showing their real logos here was an explicit, flagged
//     product decision (accepting the trademark/endorsement-implication
//     risk), not a default. Their domain isn't stored anywhere (scraped
//     listings only ever had a brand *name*), so it's resolved per brand via
//     logo.dev's own Brand Search API (searchBrandDomain) rather than a
//     hand-maintained name->domain map, which would drift the moment the top
//     10 brands change - and they will, since this list is live, not curated
//     like lib/marketplaces.ts.
//
// This runs on the anonymous homepage, so both queries must work with no
// session at all (see the anon grants in migration 024).
//
// FAILING SOFT, BUT NOT SILENTLY (revised after the slider was reported
// vanishing on repeat visits). Both functions used to swallow every error
// and return [], and LogoMarquee renders nothing for an empty list - so one
// transient Supabase or logo.dev hiccup erased the whole row with no trace
// in the logs, and it came back on the next load. "Works the first time,
// not the second" was exactly that.
//
// Two changes. Results are cached for an hour, so the overwhelming majority
// of requests never touch Supabase or logo.dev and can't be affected by a
// blip at all. And a failure now falls back to the last result that
// succeeded in this process rather than to nothing, so a blip degrades to
// slightly stale logos instead of a missing section. The fetches throw on
// error on purpose: unstable_cache would happily cache an empty array and
// pin the outage in place for the full hour.

export type ShowcaseSeller = { name: string; domain: string };
export type ShowcaseBrand = { name: string; domain: string | null };

const SELLER_LIMIT = 12;
const BRAND_LIMIT = 10;
const CACHE_SECONDS = 60 * 60;

// Last known-good result, kept per server process. Not a substitute for the
// cache above - a cold instance starts empty - but it covers the case this
// exists for: an instance that has already served the row once should not
// suddenly serve nothing because one later query failed.
let lastGoodSellers: ShowcaseSeller[] = [];
let lastGoodBrands: ShowcaseBrand[] = [];

const fetchShowcaseSellers = unstable_cache(
  async (): Promise<ShowcaseSeller[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('seller_marketing_showcase')
      .select('name, domain')
      .limit(SELLER_LIMIT);

    if (error) throw new Error(`seller_marketing_showcase: ${error.message}`);

    return (data ?? [])
      .filter((row): row is { name: string; domain: string } => !!row.name && !!row.domain)
      .map((row) => ({ name: row.name, domain: row.domain }));
  },
  ['showcase-sellers'],
  { revalidate: CACHE_SECONDS, tags: ['showcase'] },
);

const fetchShowcaseBrands = unstable_cache(
  async (): Promise<ShowcaseBrand[]> => {
    const supabase = createPublicClient();
    const [{ data, error }, platformsResult] = await Promise.all([
      supabase.rpc('top_market_brands', { p_limit: BRAND_LIMIT }),
      supabase.from('market_platforms').select('name, base_url'),
    ]);

    if (error) throw new Error(`top_market_brands: ${error.message}`);

    const brands = ((data ?? []) as { brand: string; product_count: number }[]).filter(
      (row) => !!row.brand,
    );

    // Many single-retailer platforms' scraped listings carry no real
    // manufacturer brand - Shopify defaults a product's `vendor` field to
    // the store's own name when the merchant never set one (see
    // scraper/src/sources/shopify-source.ts), which is where a "brand" like
    // "Snapcart.pk" or "Pet Master" actually comes from. logo.dev's global
    // Brand Search has no reason to know a small Pakistani storefront by
    // name and correctly returns nothing for every one of them - but this
    // app already knows that platform's exact domain, from the same
    // market_platforms row the scraper itself scrapes against. Matching on
    // that first is free and exact; searchBrandDomain (the fuzzy global
    // lookup) is only a fallback for a genuine third-party brand name
    // (Samsung, Nike, ...) that isn't one of our own tracked platforms.
    const platformDomainByName = new Map(
      ((platformsResult.data ?? []) as { name: string; base_url: string }[])
        .map((p) => [p.name.trim().toLowerCase(), sanitizeDomain(p.base_url)] as const)
        .filter((entry): entry is [string, string] => entry[1] != null),
    );

    // Resolved in parallel - each lookup is independent and searchBrandDomain
    // already fails soft to null, so one slow/failed brand can't hold up the
    // rest or take the section down. A null domain is fine: LogoTile falls
    // back to an initials avatar.
    return await Promise.all(
      brands.map(async (row) => {
        const platformDomain = platformDomainByName.get(row.brand.trim().toLowerCase());
        return { name: row.brand, domain: platformDomain ?? (await searchBrandDomain(row.brand)) };
      }),
    );
  },
  ['showcase-brands'],
  { revalidate: CACHE_SECONDS, tags: ['showcase'] },
);

export async function getShowcaseSellers(): Promise<ShowcaseSeller[]> {
  try {
    const sellers = await fetchShowcaseSellers();
    if (sellers.length > 0) lastGoodSellers = sellers;
    return sellers;
  } catch (error) {
    // Missing env vars locally, migration 024 not applied, network blip.
    // Logged rather than swallowed: an empty row used to be indistinguishable
    // from "nobody has opted in yet", which is what made this hard to chase.
    console.error('[showcase] seller lookup failed, serving last known good', error);
    return lastGoodSellers;
  }
}

export async function getShowcaseBrands(): Promise<ShowcaseBrand[]> {
  try {
    const brands = await fetchShowcaseBrands();
    if (brands.length > 0) lastGoodBrands = brands;
    return brands;
  } catch (error) {
    console.error('[showcase] brand lookup failed, serving last known good', error);
    return lastGoodBrands;
  }
}
