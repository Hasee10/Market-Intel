import {
  PRICE_POSITION_BAND_LABEL,
  classifyPricePosition,
} from '@/lib/market-intel/core/price-position-bands';
import { unitPrice } from '@/lib/market-intel/core/pack-size';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
import { getCategoryPricing } from '@/lib/market-intel/market/category-pricing';
import { findCompetitorsForProduct } from '@/lib/market-intel/market/product-matching';
import { getSellerPriceHistory } from '@/lib/market-intel/seller/price-history';
import { createClient } from '@/lib/supabase/server';
import { mobileError, mobileOk, requireMobileSeller } from '@/lib/mobile/respond';

// One of the seller's own products, placed against the market: where its
// price sits in its category, the closest competitor listings we could
// find, and how the seller has moved it over the last month.
//
// This is the screen behind a tap in the product list, and it is the screen
// the PATCH .../price write is launched from - see that route. Read the
// comparison, change the number, done, without opening a laptop.
//
// The desktop equivalent is the Competitors drawer, which shows fifteen
// listings across ten columns (ratings, sold counts, review snippets, pack
// sizes, duplicate counts, match strength bands). Five listings and four
// fields here, because a phone row that has to be scrolled sideways is a
// row nobody reads. Same source function, narrower projection - the fields
// are dropped at the boundary, not recomputed differently.

// Best-match-first, so this takes the top of the ranking rather than a
// slice of it. findCompetitorsForProduct returns up to 15.
const MAX_COMPETITORS = 5;

const PRICE_HISTORY_DAYS = 30;

type CategoryJoin = { slug: string; name: string } | { slug: string; name: string }[] | null;

function firstCategory(joined: CategoryJoin) {
  return Array.isArray(joined) ? (joined[0] ?? null) : joined;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMobileSeller(request, 'watchlists');
  if ('response' in auth) return auth.response;
  const { seller } = auth;

  const { id } = await params;

  const supabase = await createClient();

  // seller_id in the filter as well as RLS - the same double-filter the
  // PATCH route uses. Someone else's product id must 404, not leak a title.
  const { data: product, error } = await supabase
    .from('seller_products')
    .select('id, title, sell_price, currency, image_url, seller_categories(slug, name)')
    .eq('id', id)
    .eq('seller_id', seller.id)
    .maybeSingle();

  if (error) return mobileError('Could not load the product', 500);
  if (!product) return mobileError('Product not found', 404);

  const category = firstCategory(product.seller_categories as CategoryJoin);

  const productBlock = {
    id: product.id,
    title: product.title,
    // As stored, in the product's own currency - the same pair
    // /api/mobile/products returns, so the number here matches the number
    // in the list the seller just tapped. The market comparison below is
    // computed in the reporting currency and says so separately.
    price: product.sell_price != null ? Number(product.sell_price) : null,
    currency: product.currency ?? seller.reportingCurrency,
    imageUrl: product.image_url ?? null,
    categorySlug: category?.slug ?? null,
    categoryName: category?.name ?? null,
  };

  // History is the seller's own record and needs no market data, so it is
  // fetched whether or not the product is placeable against a category.
  let history;
  try {
    history = await getSellerPriceHistory(seller.id, product.id);
  } catch {
    return mobileError('Could not load the product', 500);
  }

  const historyCutoff = Date.now() - PRICE_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const priceHistory = history
    .filter((p) => p.sellPrice != null && Date.parse(p.recordedAt) >= historyCutoff)
    .map((p) => ({ date: p.recordedAt.slice(0, 10), price: p.sellPrice as number }));

  // A product with no category mapped has no band to be judged against and
  // no market scope to search for competitors in. That is an onboarding
  // gap, not a failure: 200 with the nulls, and the client says "map this
  // product to a category" rather than rendering a blank comparison.
  if (!category?.slug || product.sell_price == null) {
    return mobileOk({
      product: productBlock,
      vsMarket: null,
      closestCompetitors: [],
      priceHistory,
    });
  }

  let pricing;
  let competitors;
  let fxRates;
  try {
    [pricing, competitors, fxRates] = await Promise.all([
      getCategoryPricing(category.slug, seller.reportingCurrency),
      findCompetitorsForProduct(
        seller.id,
        product.id,
        category.slug,
        seller.reportingCurrency,
        MAX_COMPETITORS,
      ),
      getLatestFxRates(),
    ]);
  } catch {
    return mobileError('Could not load market data for this product', 500);
  }

  // Same two-step the portfolio view applies: convert into the currency the
  // category median is already in, then divide out the pack size the title
  // states. Doing it here rather than trusting the raw sell_price is what
  // stops a 6-pack being called "far above" a single-unit median.
  //
  // THE LIMIT, carried rather than hidden: only the seller's side is
  // pack-normalised. The category median is scraped as-is, so `perUnit`
  // says when the comparison is approximate and the client is expected to
  // say so too. See portfolio-pricing.ts.
  let vsMarket = null;
  if (pricing && pricing.median > 0) {
    const raw = convertCurrency(
      Number(product.sell_price),
      product.currency ?? 'PKR',
      seller.reportingCurrency,
      fxRates,
    );
    const perItem = unitPrice(raw, product.title);
    const price = perItem ?? raw;
    const pctVsMedian = (price - pricing.median) / pricing.median;
    const band = classifyPricePosition(pctVsMedian);

    vsMarket = {
      currency: seller.reportingCurrency,
      comparedPrice: price,
      categoryMedian: pricing.median,
      // Signed fraction, not a percentage: -0.051 is 5.1% below. The band
      // beside it is the same classification the portfolio screen uses, so
      // one product can't read "below" here and "at market" there.
      pctVsMedian,
      band,
      bandLabel: PRICE_POSITION_BAND_LABEL[band],
      perUnit: perItem !== raw,
      // How many scraped listings the median stands for. A median over four
      // rows is not the same claim as one over four hundred, and the client
      // is expected to temper the wording when this is small.
      sampleSize: pricing.count,
    };
  }

  return mobileOk({
    product: productBlock,

    // Null when the category has nothing scraped, or nothing priced. Say
    // "we couldn't place this product" - not a blank comparison.
    vsMarket,

    // "Closest we found", never "the same product". Confidence is title
    // similarity against hand-picked cut points and is NOT calibrated;
    // presenting it as a match probability would be a claim the number
    // cannot support.
    closestCompetitors: competitors.map((c) => ({
      title: c.matchedTitle,
      platformName: c.matchedPlatformName,
      price: c.matchedPrice,
      currency: seller.reportingCurrency,
      imageUrl: c.matchedImageUrl,
      url: c.matchedUrl,
      matchConfidence: c.confidence,
      // Signed fraction: -0.07 means the seller is 7% cheaper than this
      // listing. Precomputed because it is the whole question the screen
      // answers, and leaving the arithmetic to the client is how two
      // clients end up rounding it differently.
      priceDeltaPct: c.priceDeltaPct,
    })),

    // Ascending by date, the seller's own price only - no market band. The
    // aligned price-vs-market series the desktop chart draws needs a wide
    // chart to be readable and stays there; this backs a sparkline.
    priceHistory,
  });
}
