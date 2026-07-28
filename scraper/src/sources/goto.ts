import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { withBrowserSession } from './browser/session.js';
import type { RawProduct, SourceResult } from '../types.js';

function parsePriceText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  // "Rs. 1,561" - strip everything but digits (the "." after "Rs" isn't a
  // decimal separator, and these are always whole-rupee prices).
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  const value = Number(digits);
  return Number.isFinite(value) ? value : undefined;
}

// Each category page also embeds a schema.org ItemList JSON-LD block with a
// per-product availability URL (schema.org/InStock or /OutOfStock), keyed by
// product url - the DOM grid itself has no stock class, so this is the only
// reliable stock signal.
function parseStockByUrl($: cheerio.CheerioAPI): Map<string, boolean> {
  const stockByUrl = new Map<string, boolean>();
  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown;
    try {
      data = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const items = (data as { itemListElement?: unknown[] })?.itemListElement;
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const url = (item as { url?: string })?.url;
      const availability = (item as { offers?: { availability?: string } })?.offers?.availability;
      if (url && availability) {
        stockByUrl.set(url, /InStock$/i.test(availability));
      }
    }
  });
  return stockByUrl;
}

// The site's analyticsData JSON attribute has unescaped inner quotes, so real
// HTML parsers (cheerio included) truncate it - can't rely on it. Parse the
// visible DOM instead.
function parseCards($: cheerio.CheerioAPI, categoryPath: string): RawProduct[] {
  const products: RawProduct[] = [];
  const stockByUrl = parseStockByUrl($);

  $('.item-inner').each((_, el) => {
    const card = $(el);
    const link = card.find('.product-name a').first();
    const href = link.attr('href');
    const title = link.text().trim();
    if (!href || !title) return;

    const imageUrl = card.find('.image-bullets li.active').attr('data-image')?.trim()
      || card.find('img').first().attr('src')?.trim();

    const price = parsePriceText(card.find('.product-price .regular-price .price').first().text());
    const compareAtPrice = parsePriceText(
      card.find('.old-price .price, .special-price .price').first().text(),
    );

    products.push({
      externalId: href,
      categorySlug: categoryPath,
      title,
      url: href,
      imageUrl,
      currency: 'PKR',
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > (price ?? 0) ? compareAtPrice : undefined,
      inStock: stockByUrl.get(href),
    });
  });

  return products;
}

const MAX_PAGES = 30;

export async function scrapeGoto(): Promise<SourceResult> {
  const products: RawProduct[] = [];

  await withBrowserSession(async (browser) => {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });

    for (const categoryPath of config.gotoCategories) {
      let seenIds = new Set<string>();

      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
        const url = `https://www.goto.com.pk/${categoryPath}${pageNum > 1 ? `?p=${pageNum}` : ''}`;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const html = await page.content();
          const $ = cheerio.load(html);
          const pageProducts = parseCards($, categoryPath);

          const newIds = pageProducts.filter((p) => !seenIds.has(p.externalId));
          if (pageProducts.length === 0 || newIds.length === 0) break;

          products.push(...newIds);
          newIds.forEach((p) => seenIds.add(p.externalId));
        } catch (err) {
          console.error(`[goto] category "${categoryPath}" page ${pageNum} failed:`, (err as Error).message);
          break;
        }
      }
    }

    await page.close();
  });

  return { platformSlug: 'goto', products };
}
