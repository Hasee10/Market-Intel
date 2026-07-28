import { config } from '../config.js';
import type { RawProduct, SourceResult } from '../types.js';

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

async function scrapeCollection(collectionHandle: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];

  for (let page = 1; ; page += 1) {
    const url = `https://telemart.pk/collections/${collectionHandle}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Telemart collection "${collectionHandle}" page ${page} fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as ShopifyProductsResponse;
    if (!data.products.length) break;

    for (const p of data.products) {
      const cheapest = p.variants.reduce<ShopifyVariant | undefined>((min, v) => {
        const price = Number(v.price);
        if (!min || price < Number(min.price)) return v;
        return min;
      }, undefined);

      products.push({
        externalId: String(p.id),
        categorySlug: collectionHandle,
        title: p.title,
        brand: p.vendor || undefined,
        url: `https://telemart.pk/products/${p.handle}`,
        imageUrl: p.images?.[0]?.src,
        galleryUrls: p.images && p.images.length > 1 ? p.images.map((img) => img.src) : undefined,
        currency: 'PKR',
        price: cheapest ? Number(cheapest.price) : undefined,
        compareAtPrice: cheapest?.compare_at_price ? Number(cheapest.compare_at_price) : undefined,
        inStock: p.variants.some((v) => v.available),
      });
    }

    if (data.products.length < PAGE_LIMIT) break;
  }

  return products;
}

export async function scrapeTelemart(): Promise<SourceResult> {
  const products: RawProduct[] = [];
  for (const collection of config.telemartCollections) {
    try {
      products.push(...(await scrapeCollection(collection)));
    } catch (err) {
      console.error(`[telemart] collection "${collection}" failed:`, (err as Error).message);
    }
  }
  return { platformSlug: 'telemart', products };
}
