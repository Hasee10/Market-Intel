import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { withBrowserSession } from './browser/session.js';
import type { RawProduct, SourceResult } from '../types.js';

function parsePriceAttr(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function parseCards($: cheerio.CheerioAPI, categoryPath: string): RawProduct[] {
  const products: RawProduct[] = [];

  $('.product-item-info').each((_, el) => {
    const card = $(el);
    const details = card.find('.product-item-details');
    const link = details.find('a.product-item-link').first();
    const href = link.attr('href');
    const title = link.text().trim();
    if (!href || !title) return;

    const externalId = card.find('input[name="product"]').first().attr('value');
    if (!externalId) return;

    const price = parsePriceAttr(
      details.find('.price-box .price-wrapper').first().attr('data-price-amount'),
    );
    const compareAtPrice = parsePriceAttr(
      details.find('.old-price .price-wrapper').first().attr('data-price-amount'),
    );
    const imageUrl = card.find('.product-item-photo img').first().attr('src');

    products.push({
      externalId,
      categorySlug: categoryPath,
      title,
      url: href,
      imageUrl,
      currency: 'PKR',
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > (price ?? 0) ? compareAtPrice : undefined,
      // Same Magento family as Shophive - no per-item stock markup in the
      // grid, so a listed item is treated as in stock (default catalog only
      // lists enabled/purchasable products).
      inStock: true,
    });
  });

  return products;
}

const MAX_PAGES = 30;

export async function scrapeIshopping(): Promise<SourceResult> {
  const products: RawProduct[] = [];

  await withBrowserSession(async (browser) => {
    const page = await browser.newPage();

    for (const categoryPath of config.ishoppingCategories) {
      let seenHrefs = new Set<string>();

      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
        const url = `https://www.ishopping.pk/${categoryPath}${pageNum > 1 ? `?p=${pageNum}` : ''}`;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const html = await page.content();
          const $ = cheerio.load(html);
          const pageProducts = parseCards($, categoryPath);

          const pageHrefs = new Set(pageProducts.map((p) => p.url));
          const isDuplicate =
            pageProducts.length > 0 && [...pageHrefs].every((href) => seenHrefs.has(href));
          if (pageProducts.length === 0 || isDuplicate) break;

          products.push(...pageProducts);
          pageHrefs.forEach((href) => seenHrefs.add(href));
        } catch (err) {
          console.error(`[ishopping] category "${categoryPath}" page ${pageNum} failed:`, (err as Error).message);
          break;
        }
      }
    }

    await page.close();
  });

  return { platformSlug: 'ishopping', products };
}
