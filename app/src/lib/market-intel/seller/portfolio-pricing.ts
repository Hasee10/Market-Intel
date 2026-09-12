'server-only';

import { getCategoryPricing } from '@/lib/market-intel/market/category-pricing';
import { unitPrice } from '@/lib/market-intel/core/pack-size';
import {
  classifyPortfolio,
  type ClassifiedPortfolioProduct,
} from '@/lib/market-intel/core/price-position-bands';
import { convertCurrency, getLatestFxRates } from '@/lib/market-intel/fx';
import { createClient } from '@/lib/supabase/server';
import { dedupeCatalogueRows } from '@/lib/market-intel/seller/pricing-recommendation';

// "These six of my products are 25%+ above their own category" - the
// portfolio-wide counterpart to the Competitors drawer's per-product price
// panel. That panel is opened one product at a time; this is the screen
// that says which products are worth opening it for.
//
// The comparison here is deliberately coarser than the drawer's: each
// product against its OWN CATEGORY's median (already computed by
// getCategoryPricing, already free-tier on the Market page), not against a
// title-matched competitor. That trades precision for something the drawer
// cannot do at all - covering the whole catalogue in one pass without a
// competitor-matching query per product, which is the reason this is cheap
// enough to run on every visit rather than something to cache or paginate
// around.
//
// ONE HONEST LIMIT, carried on every row rather than fixed in the query:
// only the seller's own price is normalised for pack size (pack-size.ts).
// The category median comes from market_products.price as scraped, with no
// per-unit correction, so a category with its own mix of multipacks still
// has a somewhat inflated or deflated median. `perUnit` on each row says
// whether that row's own price was pack-adjusted, so the UI can flag it -
// not fixed silently, because fixing the OTHER side of the comparison
// would need a market-wide per-unit aggregate this does not attempt.

const MAX_PRODUCTS = 200;

export type { ClassifiedPortfolioProduct };

export async function getPortfolioPricePositions(
  sellerId: string,
  reportingCurrency: string,
): Promise<ClassifiedPortfolioProduct[]> {
  const supabase = await createClient();

  const [productsRes, fxRates] = await Promise.all([
    supabase
      .from('seller_products')
      .select('id, title, sell_price, cost_price, currency, seller_categories(slug, name)')
      .eq('seller_id', sellerId)
      .eq('is_active', true)
      .not('sell_price', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(MAX_PRODUCTS),
    getLatestFxRates(),
  ]);

  if (productsRes.error || !productsRes.data) return [];

  type Row = {
    id: string;
    title: string;
    sell_price: number | string | null;
    cost_price: number | string | null;
    currency: string | null;
    seller_categories: { slug: string; name: string } | { slug: string; name: string }[] | null;
  };

  const categoryOf = (row: Row) => {
    const category = Array.isArray(row.seller_categories) ? row.seller_categories[0] : row.seller_categories;
    return category?.slug ?? null;
  };

  // Same collapse pricing-recommendation.ts applies to the identical rows -
  // a hand-entered duplicate must read as one product here too, or it shows
  // up as two dots at the same position on a chart meant to be one-row-per-
  // product.
  const deduped = dedupeCatalogueRows(productsRes.data as Row[], categoryOf);

  const categorySlugs = [...new Set(deduped.map((d) => categoryOf(d.product)).filter((s): s is string => Boolean(s)))];

  // One getCategoryPricing call per DISTINCT category the seller actually
  // has products in - typically a handful - rather than per product. This
  // is what keeps the whole function cheap enough to run on every page
  // load: findTopProductMatches (the per-product competitor-match table)
  // pays a candidate-search query per product and caps itself at 20
  // products for exactly that reason; this has no such cap because it
  // never pays that cost.
  const pricingByCategory = new Map(
    await Promise.all(
      categorySlugs.map(
        async (slug) => [slug, await getCategoryPricing(slug, reportingCurrency)] as const,
      ),
    ),
  );

  const positions = deduped
    .map(({ product: row }) => {
      const slug = categoryOf(row);
      const categoryName = Array.isArray(row.seller_categories)
        ? row.seller_categories[0]?.name
        : row.seller_categories?.name;
      const pricing = slug ? pricingByCategory.get(slug) : null;
      if (!pricing || pricing.median <= 0) return null;

      const rawPrice = convertCurrency(Number(row.sell_price), row.currency ?? 'PKR', reportingCurrency, fxRates);
      const perItem = unitPrice(rawPrice, row.title);

      return {
        sellerProductId: row.id,
        title: row.title,
        categoryName: categoryName ?? null,
        price: perItem ?? rawPrice,
        categoryMedian: pricing.median,
        perUnit: perItem !== rawPrice,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);

  return classifyPortfolio(positions);
}
