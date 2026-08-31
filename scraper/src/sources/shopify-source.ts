import { CATEGORY_DELAY_MS, CircuitOpenError, JSON_HEADERS, PAGE_DELAY_MS, politeFetch, randomDelay } from './polite.js';
import type { RawProduct, SourceFn, SourceResult } from '../types.js';

// Shared factory for Shopify-storefront sources - vmart.ts was the first of
// these (2026-08-03) and is the template this mirrors exactly. Genuinely the
// same shape across every Shopify source added since (2026-08-29: bagallery,
// junaidjamshed, gulahmed, chasevalue, alfatah - see sources/index.ts), so
// this is a real DRY case, not the kind of premature sharing polite.ts's own
// header comment warns against retrofitting onto the *original* seven
// sources (which each have genuinely different markup/APIs, not just
// superficially similar ones).
//
// Every site instantiating this was verified live (2026-08-29): robots.txt
// allows /collections/*/products.json, and that endpoint returns real
// product data - see each call site in sources/index.ts for the specific
// verification note.

interface ShopifyVariant {
  available: boolean;
  price: string;
  compare_at_price: string | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  images?: Array<{ src: string }>;
  variants: ShopifyVariant[];
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

const PAGE_LIMIT = 250;
// Shopify keeps serving pages forever rather than erroring past the end, so
// a hard cap backs up the "short page means last page" check below.
//
// Raised 10 -> 30 (2026-08-30). At 10 the ceiling was 2,500 per collection,
// and the 2026-08-29 run returned 9,796 products for Habitt across its 4
// configured collections - 98% of the 10,000 that cap allowed, so it was
// being truncated mid-catalogue rather than running out of products. The
// short-page break below still ends every smaller collection on its own,
// so a higher cap costs extra requests only where there is genuinely more
// to fetch.
const MAX_PAGES = 30;

export function createShopifySource(opts: {
  platformSlug: string;
  /** e.g. 'https://bagallery.com' - no trailing slash. */
  baseUrl: string;
  /** Read at call time (not stored), matching every other source's config access pattern. */
  getCollections: () => string[];
}): SourceFn {
  async function scrapeCollection(collectionHandle: string): Promise<RawProduct[]> {
    const products: RawProduct[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      if (page > 1) await randomDelay(PAGE_DELAY_MS);

      const url = `${opts.baseUrl}/collections/${collectionHandle}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
      const res = await politeFetch(url, `${opts.platformSlug} ${collectionHandle} p${page}`, JSON_HEADERS, opts.platformSlug);
      const data = (await res.json()) as ShopifyProductsResponse;
      if (!data.products?.length) break;

      for (const p of data.products) {
        // A product's headline price is its cheapest variant, matching how
        // the storefront advertises it ("from Rs X") - same as vmart.ts.
        const cheapest = p.variants.reduce<ShopifyVariant | undefined>((min, v) => {
          const price = Number(v.price);
          if (!min || price < Number(min.price)) return v;
          return min;
        }, undefined);

        const price = cheapest ? Number(cheapest.price) : undefined;
        // A $0 price isn't a real price - some B2B/custom-furniture stores
        // (Habitt, Woods) list "contact for quote" items this way instead of
        // omitting a price entirely. Writing that in would show sellers a
        // fake "cheapest competitor: Rs 0", worse than no data at all.
        if (!price) continue;
        const compareAtPrice = cheapest?.compare_at_price ? Number(cheapest.compare_at_price) : undefined;

        products.push({
          externalId: String(p.id),
          categorySlug: collectionHandle,
          title: p.title,
          brand: p.vendor || undefined,
          url: `${opts.baseUrl}/products/${p.handle}`,
          imageUrl: p.images?.[0]?.src,
          galleryUrls: p.images && p.images.length > 1 ? p.images.map((img) => img.src) : undefined,
          currency: 'PKR',
          price,
          compareAtPrice: compareAtPrice && compareAtPrice > (price ?? 0) ? compareAtPrice : undefined,
          inStock: p.variants.some((v) => v.available),
        });
      }

      if (data.products.length < PAGE_LIMIT) break;
    }

    return products;
  }

  return async function scrapeShopifySource(): Promise<SourceResult> {
    const products: RawProduct[] = [];
    const collections = opts.getCollections();

    for (let i = 0; i < collections.length; i += 1) {
      const collection = collections[i];
      if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
      try {
        products.push(...(await scrapeCollection(collection)));
      } catch (err) {
        console.error(`[${opts.platformSlug}] collection "${collection}" failed:`, (err as Error).message);
        if (err instanceof CircuitOpenError) break;
      }
    }

    return { platformSlug: opts.platformSlug, products };
  };
}
