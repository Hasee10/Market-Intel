import { NextRequest } from 'next/server';

import { getSellerCategories } from '@/lib/market-intel/seller/categories';
import { getPricingRecommendations } from '@/lib/market-intel/seller/pricing-recommendation';
import {
  MOBILE_PAGE_SIZE,
  mobileError,
  mobileOk,
  requireMobileCategory,
  requireMobileSeller,
} from '@/lib/mobile/respond';

// "What should I charge?" - the rules-based recommendation the desktop
// Pricing page shows, unchanged.
//
// getPricingRecommendations is reused whole. Nothing about the rule is
// re-implemented here: the band is a matched competitor's price +/-5%, or
// the category P25-P75 when there is no confident match, floored at
// cost x 1.15. A phone showing a different number from the laptop for the
// same product would be worse than a phone showing no number at all.
//
// THE TRAP THIS ENDPOINT SETS, stated because a client developer will
// otherwise walk into it: the result set is the seller's WHOLE catalogue,
// not the selected category. `categorySlug` scopes only the title-matching
// pass; every product is still priced against ITS OWN category's band, and
// each row says which one via `categorySlug`. That is deliberate and was a
// bug fix - a seller with beds and phones had both judged against the
// beauty P75. So a Home & Kitchen row appearing under a Beauty pill is
// correct, and filtering client-side by the selected category hides valid
// advice. See pricing-recommendation.ts and MOBILE_API.md.

/**
 * Offset-in-a-cursor, unlike every feed endpoint here, which pages on a
 * timestamp.
 *
 * The feeds page by timestamp because they grow from the top as crons
 * write, so an offset would re-serve rows the client already has. This list
 * does not: it is recomputed in full from the seller's own catalogue on
 * every call, in a deterministic order (largest price gap first), and only
 * changes when the seller edits a product or a scrape moves a band. Between
 * two taps of "load more" that is stable, and an offset is honest.
 *
 * Still encoded rather than passed as `?offset=`, so the client treats it
 * as the same opaque token every other endpoint hands it and one
 * "keep calling until nextCursor is null" loop works everywhere.
 */
function encodeOffset(offset: number): string {
  return Buffer.from(`offset:${offset}`, 'utf8').toString('base64url');
}

function decodeOffset(cursor: string | null): number | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const match = /^offset:(\d+)$/.exec(decoded);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireMobileSeller(request, 'pricing_recommendations');
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const params = request.nextUrl.searchParams;

  const resolved = await requireMobileCategory(seller.id, params.get('categorySlug'));
  if ('response' in resolved) return resolved.response;
  const { domain } = resolved;

  // Fails closed, like decodeCursor. A cursor we can't read would otherwise
  // silently restart at page one, which surfaces as duplicated rows rather
  // than as an error the client can report.
  const rawCursor = params.get('cursor');
  const offset = rawCursor ? decodeOffset(rawCursor) : 0;
  if (offset === null) {
    return mobileError('Invalid cursor', 400, ['Pass back nextCursor exactly as it was given.']);
  }

  let recommendations;
  let categories;
  try {
    [recommendations, categories] = await Promise.all([
      getPricingRecommendations(seller.id, domain.categorySlug, seller.reportingCurrency),
      // Only to put a readable name next to each row's own categorySlug.
      // The recommendation itself doesn't need it, but a phone showing a
      // bare slug under a product title is the sort of thing that makes an
      // app feel like a database viewer.
      getSellerCategories(seller.id),
    ]);
  } catch {
    return mobileError('Could not load pricing recommendations', 500);
  }

  const nameBySlug = new Map(categories.map((c) => [c.slug, c.name]));

  const page = recommendations.slice(offset, offset + MOBILE_PAGE_SIZE);
  const hasMore = offset + MOBILE_PAGE_SIZE < recommendations.length;

  return mobileOk({
    currency: seller.reportingCurrency,
    // The category the matching pass ran against - NOT a filter on the rows
    // below. Named explicitly so a client can't mistake it for one.
    matchScopeCategorySlug: domain.categorySlug,
    totalCount: recommendations.length,
    recommendations: page.map((r) => ({
      productId: r.productId,
      productTitle: r.productTitle,
      categorySlug: r.categorySlug,
      categoryName: nameBySlug.get(r.categorySlug) ?? null,

      currentPrice: r.currentPrice,
      recommendedPrice: r.recommendedPrice,
      direction: r.direction,

      competitorLow: r.competitorLow,
      competitorHigh: r.competitorHigh,
      // True when the margin floor sits above the whole competitor band -
      // the seller cannot compete on price here without a thin margin.
      // A finding, not an error state.
      marginConstrained: r.marginConstrained,
      // Null when no confident title match was found and the band came from
      // the category percentiles instead. Not calibrated; see MOBILE_API.md.
      matchConfidence: r.matchConfidence,
      // Above 1 means the seller has duplicate catalogue rows for this
      // product. They are merged here (highest cost wins, so the margin
      // floor clears the dearest stock actually held) but the data problem
      // is still in their catalogue.
      duplicateEntries: r.duplicateEntries,

      // Rendered word for word. It is written for the seller and names the
      // actual figure the rule used.
      rationale: r.rationale,
    })),
    // costPrice is on the underlying type and is deliberately not passed
    // through. It is the one number in the catalogue a seller would not
    // want readable over someone's shoulder on a bus, and nothing on the
    // mobile Pricing screen needs it - the margin floor is already baked
    // into recommendedPrice and named in the rationale.
    nextCursor: hasMore ? encodeOffset(offset + MOBILE_PAGE_SIZE) : null,
  });
}
