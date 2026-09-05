// How many items a listing actually contains.
//
// Title matching cannot tell "Pack of 3" from a single item, so a seller's
// 3-pack gets compared against singles and the panel reports a number that
// is wrong by a factor of three. Seen live: an H&M 3-pack of t-shirts read
// as "164% above the median" against Outfitters singles. Per shirt the real
// gap was about 55%.
//
// The whole design principle here is that a WRONG quantity is worse than no
// quantity. Getting it wrong divides a price by a number it should not be
// divided by, and produces a confidently stated falsehood - which is worse
// than the honest un-normalised comparison it replaced. So this only
// reports a quantity for phrasings that are unambiguous, and returns 1 for
// everything else.
//
// Pure and dependency-free, which is why it sits in core/ - see
// docs/architecture.md.

/**
 * The trap this module exists to avoid.
 *
 * In Pakistani fashion "3 piece" is a garment type - shirt, trouser,
 * dupatta - and the listing is ONE outfit. "Khaadi Unstitched Lawn 3 Piece
 * Suit" naively parses to a quantity of 3 and would have its price divided
 * by three, making a comparison that was merely noisy into one that is
 * actively wrong.
 *
 * Matched anywhere in the title, not just next to the number, because the
 * real listings separate them: "3 Piece - Printed Lawn Suit".
 */
const GARMENT_NOUNS =
  /\b(suit|suits|dress|dresses|outfit|kurta|kurti|kameez|shalwar|salwar|lawn|saree|sari|abaya|ensemble|frock|peplum|trouser|dupatta)\b/i;

/**
 * Above this a "quantity" is almost certainly something else - a model
 * number, a wattage, a lumen count. Bulk listings above this do exist, but
 * mis-parsing one and dividing a price by 20000 is the worse failure.
 */
const MAX_PLAUSIBLE_UNITS = 144;

/**
 * Unambiguous multipack phrasings, most specific first.
 *
 * Every one of these names a container word - pack, set, bundle, pcs -
 * because that is what separates "Pack of 3" from "Size 3", "Mach3",
 * "H4" and "Note 13". A bare number next to a noun is never read as a
 * quantity.
 */
const PACK_PATTERNS: RegExp[] = [
  // "Pack of 3", "Set of 12", "Bundle of 5", "Box of 24"
  /\b(?:pack|set|bundle|box|combo)\s+of\s+(\d{1,3})\b/i,
  // "3-Pack", "12 Pack"
  /\b(\d{1,3})\s*-?\s*(?:pack|packs)\b/i,
  // "5-Car Pack" - one descriptor between the count and the container
  // word. Hyphenated and single-word only, so this cannot reach across a
  // title and pair unrelated tokens.
  /\b(\d{1,3})\s*-\s*\w+\s+(?:pack|packs|set|bundle)\b/i,
  // "2pcs", "32pc", "6 pieces" - pcs is only ever a count
  /\b(\d{1,3})\s*-?\s*(?:pcs|pc)\b/i,
  // "5-Piece ... Set" and "6 Pieces" - guarded by the garment check below
  /\b(\d{1,3})\s*-?\s*(?:piece|pieces)\b/i,
  // "Pack: 3", "Quantity: 6"
  /\b(?:pack|qty|quantity)\s*[:=]\s*(\d{1,3})\b/i,
];

export type PackSize = {
  /** Items in the listing. 1 when unknown - never 0, never null. */
  units: number;
  /**
   * Whether a multipack was actually detected, as opposed to defaulted.
   * The distinction matters: "we know it is 1" and "we assume it is 1" look
   * identical in the number and different in how much a comparison built
   * on it can be trusted.
   */
  detected: boolean;
};

/**
 * Reads how many items a product title describes.
 *
 * Returns { units: 1, detected: false } whenever the title does not state a
 * quantity unambiguously - which is the common case and the safe default.
 */
export function parsePackSize(title: string): PackSize {
  const fallback: PackSize = { units: 1, detected: false };
  if (!title) return fallback;

  const text = title.trim();

  // No blanket denylist for "Size 3" or "3 in 1": every pattern below
  // requires a container word (pack, set, pcs), so a bare number beside a
  // noun is already unreachable. A denylist scanning the whole title was
  // worse than nothing - it threw away "Pampers ... Size 3 - Pack of 50",
  // where a size and a real quantity sit in one string.
  const isGarment = GARMENT_NOUNS.test(text);

  for (const pattern of PACK_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    // "N piece(s)" and "N pc(s)" on a garment describe a construction -
    // shirt, trouser, dupatta - not a quantity. Keyed on the matched TEXT
    // rather than on which pattern fired, so both spellings are covered
    // and an explicit "Pack of 3" on a garment still counts as a real
    // multipack: the container word is what disambiguates.
    const isBareCountForm =
      /\b\d{1,3}\s*-?\s*(?:piece|pieces|pcs|pc)\b/i.test(match[0]) &&
      !/pack|set|bundle|box|combo/i.test(match[0]);
    if (isGarment && isBareCountForm) return fallback;

    const units = Number(match[1]);
    if (!Number.isInteger(units) || units < 2 || units > MAX_PLAUSIBLE_UNITS) continue;

    return { units, detected: true };
  }

  return fallback;
}

/**
 * Price for one item, given the listing's price and its title.
 *
 * Returns null for a null price rather than 0, so "no price" stays
 * distinguishable from "free".
 */
export function unitPrice(price: number | null, title: string): number | null {
  if (price == null) return null;
  const { units } = parsePackSize(title);
  return units > 1 ? price / units : price;
}

/**
 * Whether a set of titles describes different pack sizes.
 *
 * This is the condition that makes a raw price comparison invalid: fifteen
 * singles against one 3-pack is not a like-for-like set, and the panel has
 * to say so rather than quietly reporting a median three times too low.
 */
export function hasMixedPackSizes(titles: string[]): boolean {
  const sizes = new Set(titles.map((t) => parsePackSize(t).units));
  return sizes.size > 1;
}
