import { CATEGORY_DELAY_MS, CircuitOpenError, JSON_HEADERS, PAGE_DELAY_MS, decodeHtmlEntities, politeFetch, randomDelay } from './polite.js';
import type { RawProduct, SourceFn, SourceResult } from '../types.js';

// Shared factory for WooCommerce Store API sources - added 2026-08-29 when
// petfit.ts and luminaria.ts were being written as two more near-identical
// files alongside the already-shipped shopperspk.ts/petshub.ts. Those two
// stay as their own files (not retrofitted) since they already work and
// touching shipped code without being asked adds risk for no benefit; this
// factory only covers the two new ones, a genuine DRY case since they are
// being added in the same batch with identical structure - same reasoning
// shopify-source.ts's header gives for its own factory.

interface WooImage {
  src: string;
}

interface WooPrices {
  price: string;
  regular_price: string;
  currency_code: string;
  currency_minor_unit: number;
}

interface WooProduct {
  id: number;
  name: string;
  permalink: string;
  prices?: WooPrices;
  images?: WooImage[];
  is_in_stock?: boolean;
}

const PER_PAGE = 100;
const MAX_PAGES = 10;

// WooCommerce reports money in minor units - see shopperspk.ts for why this
// conversion is done properly rather than assumed.
function toMajorUnits(raw: string | undefined, minorUnit: number): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  return minorUnit > 0 ? value / 10 ** minorUnit : value;
}

export function createWooCommerceSource(opts: {
  platformSlug: string;
  /** e.g. 'https://petfit.pk' - no trailing slash. */
  baseUrl: string;
  /** Read at call time (not stored), matching every other source's config access pattern. */
  getCategories: () => string[];
}): SourceFn {
  async function scrapeCategory(categorySlug: string): Promise<RawProduct[]> {
    const products: RawProduct[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      if (page > 1) await randomDelay(PAGE_DELAY_MS);

      const url =
        `${opts.baseUrl}/wp-json/wc/store/v1/products` +
        `?per_page=${PER_PAGE}&page=${page}&category=${encodeURIComponent(categorySlug)}`;
      const res = await politeFetch(url, `${opts.platformSlug} ${categorySlug} p${page}`, JSON_HEADERS, opts.platformSlug);
      const data = (await res.json()) as WooProduct[];
      if (!Array.isArray(data) || data.length === 0) break;

      for (const p of data) {
        if (!p.name || !p.permalink) continue;

        const minorUnit = p.prices?.currency_minor_unit ?? 0;
        const price = toMajorUnits(p.prices?.price, minorUnit);
        const regularPrice = toMajorUnits(p.prices?.regular_price, minorUnit);
        // A $0 price isn't a real price - see shopify-source.ts for the same
        // "contact for quote" pattern on custom/B2B items.
        if (!price) continue;

        products.push({
          externalId: String(p.id),
          categorySlug,
          title: decodeHtmlEntities(p.name),
          url: p.permalink,
          imageUrl: p.images?.[0]?.src,
          galleryUrls: p.images && p.images.length > 1 ? p.images.map((img) => img.src) : undefined,
          currency: p.prices?.currency_code || 'PKR',
          price,
          compareAtPrice: regularPrice && price != null && regularPrice > price ? regularPrice : undefined,
          inStock: p.is_in_stock,
        });
      }

      if (data.length < PER_PAGE) break;
    }

    return products;
  }

  return async function scrapeWooCommerceSource(): Promise<SourceResult> {
    const products: RawProduct[] = [];
    const categories = opts.getCategories();

    for (let i = 0; i < categories.length; i += 1) {
      const category = categories[i];
      if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
      try {
        products.push(...(await scrapeCategory(category)));
      } catch (err) {
        console.error(`[${opts.platformSlug}] category "${category}" failed:`, (err as Error).message);
        if (err instanceof CircuitOpenError) break;
      }
    }

    return { platformSlug: opts.platformSlug, products };
  };
}
