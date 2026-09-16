import { NextRequest } from 'next/server';

import { searchMarketProducts } from '@/lib/market-intel/seller/watchlists';
import { mobileError, mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// The magnifying glass in the top bar: search what COMPETITORS are selling.
//
// Not to be confused with /api/mobile/products?q=, which searches the
// seller's own catalogue. Two searches over two different corpora, and the
// app has to make clear which one the seller is in - see MOBILE_API.md.
//
// Reuses searchMarketProducts, the same function the desktop watchlist
// picker uses, so a title that finds a product on the phone finds it on a
// laptop too. That function scopes through the taxonomy rather than
// comparing the seller's category slug to the scraped one directly, which
// matters: the naive comparison matched zero rows for every onboarded
// seller (see its header comment).
//
// Nothing is scraped on demand. This reads what the last cron run wrote.

// Below this a substring match is not a search, it is a table scan that
// returns most of the market. The desktop picker applies the same floor.
const MIN_QUERY_LENGTH = 2;

export async function GET(request: NextRequest) {
  const auth = await requireMobileSeller(request, 'competitor_intel');
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const params = request.nextUrl.searchParams;
  const query = (params.get('q') ?? '').trim();

  // An empty result rather than a 400. The client calls this on every
  // keystroke, and the first one or two characters are a normal state to
  // pass through - not an error worth rendering a failure card for.
  if (query.length < MIN_QUERY_LENGTH) {
    return mobileOk(
      { query, results: [], nextCursor: null },
      `Type at least ${MIN_QUERY_LENGTH} characters`,
    );
  }

  // Optional on purpose. Omitting it searches everything scraped, which is
  // the right default for "I am holding a box at a supplier and I don't
  // know which of my markets it belongs to".
  const categorySlug = params.get('categorySlug')?.trim() || undefined;

  let results;
  try {
    results = await searchMarketProducts(query, categorySlug);
  } catch {
    return mobileError('Could not search the market', 500);
  }

  return mobileOk({
    query,
    // Per row, not per response: prices are as scraped and are NOT
    // converted to the seller's reporting currency. Saying so in the shape
    // is better than a top-level currency field that would be wrong for a
    // market carrying more than one.
    results: results.map((r) => ({
      id: r.id,
      title: r.title,
      platformName: r.platformName,
      price: r.price,
      currency: r.currency,
      inStock: r.inStock,
      imageUrl: r.imageUrl,
      url: r.url,
    })),
    // Always null: searchMarketProducts caps at 20 with no offset, so there
    // is no second page to hand out. The field is present rather than
    // omitted because every other list endpoint has it, and a client that
    // special-cased its absence here would break the day pagination lands.
    // Widening it later is additive - null becomes a cursor, and the
    // client's existing "stop when null" logic keeps working untouched.
    nextCursor: null,
  });
}
