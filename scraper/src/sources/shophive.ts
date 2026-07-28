import * as cheerio from 'cheerio';
import { config } from '../config.js';
import type { RawProduct, SourceResult } from '../types.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const PAGE_SIZE = 16;
const MAX_PAGES = 30;

function parsePriceAttr(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

async function scrapeCategoryPage(categoryPath: string, page: number): Promise<RawProduct[]> {
  const url = `https://www.shophive.com/${categoryPath}${page > 1 ? `?p=${page}` : ''}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Shophive category "${categoryPath}" page ${page} fetch failed: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const products: RawProduct[] = [];

  $('.products-grid .item.product.product-item').each((_, el) => {
    const info = $(el).find('.product-item-info').first();
    const link = info.find('a.product-item-link, a.product-item-photo').first();
    const href = link.attr('href');
    const title = info.find('a.product-item-link').first().attr('title')?.trim()
      || info.find('a.product-item-link').first().text().trim();
    if (!href || !title) return;

    const skuInput = info.find('input[name="product"]').first().attr('value');
    if (!skuInput) return;

    const price = parsePriceAttr(
      info.find('.price-container:not(.old-price .price-container) .price-wrapper').first().attr('data-price-amount')
    );
    const compareAtPrice = parsePriceAttr(
      info.find('.old-price .price-wrapper').first().attr('data-price-amount')
    );
    const imageUrl = info.find('img.product-image-photo').first().attr('src');

    products.push({
      externalId: skuInput,
      categorySlug: categoryPath,
      title,
      url: href,
      imageUrl,
      currency: 'PKR',
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > (price ?? 0) ? compareAtPrice : undefined,
      // Shophive's category grid has no per-item stock markup (no
      // "sold out"/"notify me" class or label) - Magento's default catalog
      // only lists enabled, purchasable products, so a listed item is in stock.
      inStock: true,
    });
  });

  return products;
}

async function scrapeCategory(categoryPath: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageProducts = await scrapeCategoryPage(categoryPath, page);
    if (pageProducts.length === 0) break;
    products.push(...pageProducts);
    if (pageProducts.length < PAGE_SIZE) break;
  }
  return products;
}

export async function scrapeShophive(): Promise<SourceResult> {
  const products: RawProduct[] = [];
  for (const category of config.shophiveCategories) {
    try {
      products.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[shophive] category "${category}" failed:`, (err as Error).message);
    }
  }
  return { platformSlug: 'shophive', products };
}
