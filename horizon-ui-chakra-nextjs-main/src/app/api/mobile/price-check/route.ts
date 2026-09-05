import { NextRequest } from 'next/server';

import { getPreLaunchInsight } from '@/lib/market-intel/pre-launch';
import { getPrimaryDomain, listCategories } from '@/lib/market-intel/seller';
import { mobileError, mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// The quick action the mobile app exists for: "should I stock this, and at
// what price?"
//
// Keyed on a title string, not a product id, because the seller is standing
// at a supplier looking at something they do not own yet. That is also why
// it falls back to the seller's primary domain when no category is given -
// asking someone to pick a taxonomy slug on a phone before they can get an
// answer would defeat the point.
//
// Reads only. No scrape is triggered; this searches what the last scraper
// run already wrote.

const MAX_TITLE_LENGTH = 200;

export async function GET(request: NextRequest) {
  const auth = await requireMobileSeller(request, 'competitor_intel');
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const params = request.nextUrl.searchParams;
  const title = (params.get('title') ?? '').trim();

  if (!title) {
    return mobileError('A product title is required', 400, [
      'Pass ?title=<product name>. Optionally ?categorySlug= and ?intendedPrice=.',
    ]);
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return mobileError('Product title is too long', 400, [
      `Titles are capped at ${MAX_TITLE_LENGTH} characters.`,
    ]);
  }

  // An unparseable price is dropped rather than rejected: the price is an
  // optional refinement, and failing the whole lookup because of it would
  // withhold the market read the seller actually asked for.
  const rawPrice = params.get('intendedPrice');
  const parsedPrice = rawPrice != null ? Number(rawPrice) : NaN;
  const intendedPrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : null;

  const requestedSlug = params.get('categorySlug');
  const domain = requestedSlug ? null : await getPrimaryDomain(seller.id);
  const categorySlug = requestedSlug ?? domain?.categorySlug ?? null;

  if (!categorySlug) {
    return mobileError('No category to search in', 400, [
      'Pass ?categorySlug=, or set a primary category on your account first.',
    ]);
  }

  // Resolved for display only - the insight itself keys on the slug. Looked
  // up rather than echoed back so the app never shows a slug where a person
  // expects a category name.
  const categories = await listCategories();
  const categoryName = categories.find((c) => c.slug === categorySlug)?.name ?? domain?.categoryName ?? null;

  const insight = await getPreLaunchInsight(title, categorySlug, seller.reportingCurrency, {
    sellerId: seller.id,
    intendedPrice,
    categoryName,
  });

  return mobileOk(insight);
}
