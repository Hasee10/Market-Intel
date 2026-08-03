'server-only';

import { createPublicClient } from '@/lib/supabase/server';
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
// session at all (see the anon grants in migration 024) and must fail soft:
// a Supabase outage or an unapplied migration 024 should hide this section,
// not break the homepage build or render.

export type ShowcaseSeller = { name: string; domain: string };
export type ShowcaseBrand = { name: string; domain: string | null };

const SELLER_LIMIT = 12;
const BRAND_LIMIT = 10;

export async function getShowcaseSellers(): Promise<ShowcaseSeller[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('seller_marketing_showcase')
      .select('name, domain')
      .limit(SELLER_LIMIT);

    if (error || !data) return [];

    return data
      .filter((row): row is { name: string; domain: string } => !!row.name && !!row.domain)
      .map((row) => ({ name: row.name, domain: row.domain }));
  } catch {
    // Missing env vars locally, migration 024 not yet applied, network
    // error, etc. - none of these should take the homepage down.
    return [];
  }
}

export async function getShowcaseBrands(): Promise<ShowcaseBrand[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc('top_market_brands', { p_limit: BRAND_LIMIT });

    if (error || !data) return [];

    const brands = (data as { brand: string; product_count: number }[]).filter((row) => !!row.brand);

    // Resolved in parallel - each lookup is independent and searchBrandDomain
    // already fails soft to null, so one slow/failed brand can't hold up the
    // rest or take the section down.
    return await Promise.all(
      brands.map(async (row) => ({ name: row.brand, domain: await searchBrandDomain(row.brand) })),
    );
  } catch {
    return [];
  }
}
