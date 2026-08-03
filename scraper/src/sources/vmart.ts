import { config } from '../config.js';
import { CATEGORY_DELAY_MS, JSON_HEADERS, PAGE_DELAY_MS, politeFetch, randomDelay } from './polite.js';
import type { RawProduct, SourceResult } from '../types.js';

// Vmart.pk - Pakistani computing/gaming-peripherals retailer (gaming mice,
// keyboards, headsets, monitors, PC components, car accessories). Adds
// accessory-tier price points that the mobiles/laptops-heavy sources mostly
// miss.
//
// Shopify, so this reads the same public `/collections/{handle}/products.json`
// endpoint telemart.ts already uses - structured JSON rather than parsed
// markup, which is both politer and far less brittle than HTML selectors.
// Verified live on 2026-08-03 against /collections/gaming-mouse-pakistan.
//
// ROBOTS: vmart.pk/robots.txt is Shopify's standard file - it disallows
// /admin, /cart, /checkout, /orders, /account and `/collections/*sort_by*`,
// none of which this source requests. Plain /collections/{handle} paths and
// their .json representation are crawlable. Verified 2026-08-03.

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
  product_type?: string;
  images?: Array<{ src: string }>;
  variants: ShopifyVariant[];
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

const PAGE_LIMIT = 250;
// Shopify keeps serving pages forever rather than erroring past the end, so a
// hard cap backs up the "short page means last page" check below.
const MAX_PAGES = 10;

async function scrapeCollection(collectionHandle: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) await randomDelay(PAGE_DELAY_MS);

    const url = `https://vmart.pk/collections/${collectionHandle}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
    const res = await politeFetch(url, `vmart ${collectionHandle} p${page}`, JSON_HEADERS);
    const data = (await res.json()) as ShopifyProductsResponse;
    if (!data.products?.length) break;

    for (const p of data.products) {
      // A product's headline price is its cheapest variant, matching how the
      // storefront advertises it ("from Rs X").
      const cheapest = p.variants.reduce<ShopifyVariant | undefined>((min, v) => {
        const price = Number(v.price);
        if (!min || price < Number(min.price)) return v;
        return min;
      }, undefined);

      const price = cheapest ? Number(cheapest.price) : undefined;
      const compareAtPrice = cheapest?.compare_at_price ? Number(cheapest.compare_at_price) : undefined;

      products.push({
        externalId: String(p.id),
        categorySlug: collectionHandle,
        title: p.title,
        brand: p.vendor || undefined,
        url: `https://vmart.pk/products/${p.handle}`,
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

export async function scrapeVmart(): Promise<SourceResult> {
  const products: RawProduct[] = [];

  for (let i = 0; i < config.vmartCollections.length; i += 1) {
    const collection = config.vmartCollections[i];
    if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
    try {
      products.push(...(await scrapeCollection(collection)));
    } catch (err) {
      console.error(`[vmart] collection "${collection}" failed:`, (err as Error).message);
    }
  }

  return { platformSlug: 'vmart', products };
}
