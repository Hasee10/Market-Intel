'server-only';

import { createPublicClient } from '@/lib/supabase/server';

// Data for the public marketing homepage's company slider (see
// components/landing/CompanyLogoSlider.tsx). Two sources, deliberately kept
// separate rather than merged into one query:
//
//   - Real sellers who opted in via Settings > "Show my logo on the Ryvl
//     site" (seller_marketing_showcase view, migration 024). Genuine
//     customers, genuine consent, so these render as real logo.dev logos.
//   - Brands actually present in scraped market_products (top_market_brands
//     RPC, migration 024). These are third parties we have no relationship
//     or consent from - Samsung/Nike/etc. did not agree to appear on this
//     site, so unlike the seller entries and the existing marketplace-logo
//     row (which shows retail *platforms* whose public prices we scrape,
//     not endorsements), brand entries are rendered as plain text pills by
//     the component, never as fetched trademark logos. Do not change
//     CompanyLogoSlider to fetch logo.dev images for these without checking
//     with whoever owns that legal call first.
//
// This runs on the anonymous homepage, so both queries must work with no
// session at all (see the anon grants in migration 024) and must fail soft:
// a Supabase outage or an unapplied migration 024 should hide this section,
// not break the homepage build or render.

export type ShowcaseSeller = { name: string; domain: string };
export type ShowcaseBrand = { name: string };

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

    return (data as { brand: string; product_count: number }[])
      .filter((row) => !!row.brand)
      .map((row) => ({ name: row.brand }));
  } catch {
    return [];
  }
}
