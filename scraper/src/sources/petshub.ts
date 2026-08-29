import { config } from '../config.js';
import { CATEGORY_DELAY_MS, CircuitOpenError, JSON_HEADERS, PAGE_DELAY_MS, politeFetch, randomDelay } from './polite.js';
import type { RawProduct, SourceResult } from '../types.js';

// Petshub.pk - added 2026-08-29 to fill the pet-supplies gap (previously only
// covered incidentally by beauty/home-focused sources like bagallery's
// baby-care collection). WooCommerce, read through the public Store API
// (`/wp-json/wc/store/v1/products`), same contract as shopperspk.ts - not
// factored into a shared function since this is only the second WooCommerce
// Store API source (vs. 5 for Shopify, where a factory paid off).
//
// ROBOTS (verified 2026-08-29): `User-agent: *` is `Allow: /`, only
// `/wp-admin/` disallowed (with `/wp-admin/admin-ajax.php` carved back out,
// standard WordPress boilerplate) - this source is fully permitted.

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

async function scrapeCategory(categorySlug: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) await randomDelay(PAGE_DELAY_MS);

    const url =
      `https://www.petshub.pk/wp-json/wc/store/v1/products` +
      `?per_page=${PER_PAGE}&page=${page}&category=${encodeURIComponent(categorySlug)}`;
    const res = await politeFetch(url, `petshub ${categorySlug} p${page}`, JSON_HEADERS, 'petshub');
    const data = (await res.json()) as WooProduct[];
    if (!Array.isArray(data) || data.length === 0) break;

    for (const p of data) {
      if (!p.name || !p.permalink) continue;

      const minorUnit = p.prices?.currency_minor_unit ?? 0;
      const price = toMajorUnits(p.prices?.price, minorUnit);
      const regularPrice = toMajorUnits(p.prices?.regular_price, minorUnit);

      products.push({
        externalId: String(p.id),
        categorySlug,
        title: p.name,
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

export async function scrapePetshub(): Promise<SourceResult> {
  const products: RawProduct[] = [];

  for (let i = 0; i < config.petshubCategories.length; i += 1) {
    const category = config.petshubCategories[i];
    if (i > 0) await randomDelay(CATEGORY_DELAY_MS);
    try {
      products.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[petshub] category "${category}" failed:`, (err as Error).message);
      if (err instanceof CircuitOpenError) break;
    }
  }

  return { platformSlug: 'petshub', products };
}
