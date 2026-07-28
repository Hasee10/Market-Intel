import * as cheerio from 'cheerio';
import { config } from '../config.js';
import type { RawProduct, SourceResult } from '../types.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function parsePrice(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}

function externalIdFromUrl(url: string): string {
  // e.g. https://priceoye.pk/mobiles/samsung/samsung-galaxy-a07 -> samsung-galaxy-a07
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

async function scrapeCategory(categorySlug: string): Promise<RawProduct[]> {
  const url = `https://priceoye.pk/${categorySlug}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`PriceOye category "${categorySlug}" fetch failed: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const products: RawProduct[] = [];
  const seen = new Set<string>();

  $('.productBox').each((_, el) => {
    const anchor = $(el).find('a').first();
    const href = anchor.attr('href');
    if (!href) return;
    if (seen.has(href)) return;
    seen.add(href);

    const title = $(el).find('.p-title').first().text().trim();
    if (!title) return;

    const price = parsePrice($(el).find('.price-box span').first().text());
    const compareAtPrice = parsePrice($(el).find('.price-diff-retail span').first().text());
    const imageUrl = $(el).find('img.product-thumbnail-img').attr('src');
    const rating = Number($(el).find('.user-rating-content .h6').first().text().trim()) || undefined;
    const ratingCount = Number($(el).find('.user-rating-content .rating-h7').first().text().trim().replace(/[^\d]/g, '')) || undefined;

    products.push({
      externalId: externalIdFromUrl(href),
      categorySlug,
      title,
      url: href,
      imageUrl,
      currency: 'PKR',
      price,
      compareAtPrice,
      rating,
      ratingCount,
      // PriceOye's category grid has no per-item stock badge (the
      // "in_stock" class that exists on the page belongs to a filter-sidebar
      // icon, not the product card) - listed items are purchasable.
      inStock: true,
    });
  });

  return products;
}

export async function scrapePriceoye(): Promise<SourceResult> {
  const products: RawProduct[] = [];
  for (const category of config.priceoyeCategories) {
    try {
      products.push(...(await scrapeCategory(category)));
    } catch (err) {
      console.error(`[priceoye] category "${category}" failed:`, (err as Error).message);
    }
  }
  return { platformSlug: 'priceoye', products };
}
