// Buckets a signed "vs category median" percentage into a band a seller can
// scan without doing arithmetic - the same "bands, not raw numbers" grammar
// PricePositionStrip established for a single product, generalised to the
// question "which of my products are priced out of line?" across the whole
// catalogue.
//
// Fixed cutoffs rather than computed ones (contrast niceStep in
// PricePositionStrip.tsx): a percentage already has a universal, meaningful
// scale - everyone reads "40% above" as a big gap without being told the
// range of the dataset first - where an absolute price needs the data's own
// range to pick sensible bands. ±5% mirrors the "at market" tolerance
// PricePositionStrip already uses, so a product this calls "at market"
// would not be called "above" by that panel looking at the same product.
//
// Pure, so it lives in core/ - see docs/architecture.md.

export type PricePositionBand = 'far-below' | 'below' | 'at-market' | 'above' | 'far-above';

const AT_MARKET_TOLERANCE = 0.05;
const FAR_THRESHOLD = 0.25;

export function classifyPricePosition(pctVsMedian: number): PricePositionBand {
  if (pctVsMedian <= -FAR_THRESHOLD) return 'far-below';
  if (pctVsMedian < -AT_MARKET_TOLERANCE) return 'below';
  if (pctVsMedian <= AT_MARKET_TOLERANCE) return 'at-market';
  if (pctVsMedian < FAR_THRESHOLD) return 'above';
  return 'far-above';
}

export const PRICE_POSITION_BAND_LABEL: Record<PricePositionBand, string> = {
  'far-below': '25%+ below',
  below: '5–25% below',
  'at-market': 'Within 5%',
  above: '5–25% above',
  'far-above': '25%+ above',
};

/**
 * Order bands render in, worst-for-a-seller first - a product priced far
 * above its own category is the one worth looking at before the ones
 * already fine.
 */
export const PRICE_POSITION_BAND_ORDER: PricePositionBand[] = [
  'far-above',
  'above',
  'at-market',
  'below',
  'far-below',
];

export type PortfolioProduct = {
  sellerProductId: string;
  title: string;
  /**
   * The category this row was judged against - carried alongside the name
   * so a caller can scope the set to one market without re-querying. The
   * mobile Market screen needs this: its price stats and forecast are for
   * one category, and mixing in products from another under the same
   * heading would be the same class of error pricing-recommendation.ts was
   * fixed for.
   */
  categorySlug: string | null;
  categoryName: string | null;
  /** The seller's own price, per item where parsePackSize could tell. */
  price: number;
  categoryMedian: number;
  /** Whether price/categoryMedian is a per-item comparison. See the caller. */
  perUnit: boolean;
};

export type ClassifiedPortfolioProduct = PortfolioProduct & {
  pctVsMedian: number;
  band: PricePositionBand;
};

export type PortfolioBandSummary = {
  band: PricePositionBand;
  count: number;
  products: ClassifiedPortfolioProduct[];
};

export function classifyPortfolio(products: PortfolioProduct[]): ClassifiedPortfolioProduct[] {
  return products
    .filter((p) => p.categoryMedian > 0)
    .map((p) => {
      const pctVsMedian = (p.price - p.categoryMedian) / p.categoryMedian;
      return { ...p, pctVsMedian, band: classifyPricePosition(pctVsMedian) };
    });
}

/**
 * Groups classified products into the five bands, in display order, with
 * the furthest-from-median products first inside each band - the ones
 * worth looking at before the borderline ones.
 */
export function summarisePortfolioBands(products: ClassifiedPortfolioProduct[]): PortfolioBandSummary[] {
  return PRICE_POSITION_BAND_ORDER.map((band) => {
    const inBand = products
      .filter((p) => p.band === band)
      .sort((a, b) => Math.abs(b.pctVsMedian) - Math.abs(a.pctVsMedian));
    return { band, count: inBand.length, products: inBand };
  });
}
