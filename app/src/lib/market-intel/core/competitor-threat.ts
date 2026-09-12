// Which competitors are actually dangerous, rather than merely cheaper.
//
// Price alone cannot answer that. Someone undercutting you with a badly
// reviewed listing is not taking your sales; someone undercutting you with
// a well reviewed one is. Splitting the matched listings on both axes at
// once is what separates the two, and it is the question a seller asks
// after "am I expensive" - "does it matter?"
//
// TWO HONEST LIMITS, both surfaced by the caller rather than hidden:
//
//   1. Only Daraz and PriceOye publish ratings (2 of the 16 scrapers). On a
//      market served by single-retailer sites - which is most of fashion,
//      auto parts and home - there is no rating data at all and this
//      returns nothing to show. That is a coverage fact, not a failure, and
//      the UI says so instead of drawing an empty chart.
//   2. seller_products carries no rating, so the seller's own quality is
//      unknown. Everything here is therefore about the competition's
//      standing relative to each other, never "you versus them on quality".
//
// Pure, so it lives in core/ - see docs/architecture.md.

/**
 * Ratings below this many reviews are noise. A lone 5.0 from two people is
 * not evidence of a well-run competitor, and treating it as one would put
 * the least established listing at the top of a threat list.
 */
export const MIN_CREDIBLE_REVIEWS = 5;

/** Fewer rated listings than this and there is no distribution to split. */
export const MIN_RATED_LISTINGS = 3;

export type RatedListing = {
  title: string;
  platformName: string | null;
  /** Per item, already normalised for pack size by the caller. */
  price: number | null;
  rating: number | null;
  ratingCount: number | null;
  url: string;
};

export type ThreatBand = 'threat' | 'cheaper-but-weaker' | 'premium' | 'no-advantage';

export type ClassifiedListing = RatedListing & {
  rating: number;
  price: number;
  band: ThreatBand;
};

export type ThreatAnalysis = {
  /** Listings carrying a credible rating - the only ones classified. */
  classified: ClassifiedListing[];
  /** Cheaper than the seller AND better rated than the typical listing. */
  threats: ClassifiedListing[];
  /** The rating a listing has to beat to count as well regarded here. */
  ratingBar: number;
  /** How many matched listings carried no usable rating at all. */
  unratedCount: number;
  /**
   * Whether there is enough rated supply to say anything. False means the
   * caller should explain the coverage gap rather than render a chart.
   */
  hasEnoughData: boolean;
};

/**
 * Splits matched listings into price/quality bands against the seller.
 *
 * The rating bar is the median of the rated listings rather than a fixed
 * 4.0, because marketplace ratings inflate differently per category - a
 * 4.3 that is unremarkable among phones can be strong among auto parts.
 * Relative to the set is the comparison that survives that.
 */
export function analyseThreats(
  listings: RatedListing[],
  sellerPrice: number | null,
): ThreatAnalysis {
  const usable = listings.filter(
    (l): l is RatedListing & { rating: number; price: number } =>
      l.rating != null &&
      l.price != null &&
      Number.isFinite(l.rating) &&
      Number.isFinite(l.price) &&
      l.price > 0 &&
      (l.ratingCount ?? 0) >= MIN_CREDIBLE_REVIEWS,
  );

  const unratedCount = listings.length - usable.length;

  if (usable.length < MIN_RATED_LISTINGS) {
    return {
      classified: [],
      threats: [],
      ratingBar: 0,
      unratedCount,
      hasEnoughData: false,
    };
  }

  const ratings = usable.map((l) => l.rating).sort((a, b) => a - b);
  const ratingBar = ratings[Math.floor(ratings.length / 2)];

  const classified: ClassifiedListing[] = usable.map((l) => {
    // No seller price means no cheaper/dearer axis. Everything falls to the
    // quality read alone rather than being guessed onto one side.
    const cheaper = sellerPrice != null && l.price < sellerPrice;
    const wellRated = l.rating >= ratingBar;

    const band: ThreatBand =
      sellerPrice == null
        ? wellRated
          ? 'premium'
          : 'no-advantage'
        : cheaper && wellRated
          ? 'threat'
          : cheaper
            ? 'cheaper-but-weaker'
            : wellRated
              ? 'premium'
              : 'no-advantage';

    return { ...l, band };
  });

  const threats = classified
    .filter((l) => l.band === 'threat')
    // Worst first: cheapest among the well rated is the one to look at.
    .sort((a, b) => a.price - b.price);

  return { classified, threats, ratingBar, unratedCount, hasEnoughData: true };
}

export const THREAT_BAND_LABEL: Record<ThreatBand, string> = {
  threat: 'Cheaper and better rated',
  'cheaper-but-weaker': 'Cheaper, but rated below the pack',
  premium: 'Dearer, and better rated',
  'no-advantage': 'Dearer and rated below the pack',
};
