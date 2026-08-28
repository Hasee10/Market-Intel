import * as cheerio from 'cheerio';
import { politeFetch, JSON_HEADERS } from '../sources/polite.js';
import type { RawReview } from '../types.js';

// Verified live (2026-08-29) against a real PriceOye product page: the
// <script type="application/ld+json"> Product block includes a `review`
// array with reviewBody/author.name/reviewRating.ratingValue/datePublished
// - no CSS-selector scraping of the visible review widget needed, and no
// extra JS rendering required (this works with a plain HTTP fetch, unlike
// Daraz - see this feature's migration header comment).
type JsonLdReview = {
  reviewBody?: string;
  datePublished?: string;
  author?: { name?: string };
  reviewRating?: { ratingValue?: number };
};

type JsonLdProduct = {
  '@type'?: string;
  review?: JsonLdReview[];
};

export async function scrapePriceoyeProductReviews(url: string): Promise<RawReview[]> {
  const res = await politeFetch(url, `priceoye reviews (${url})`, JSON_HEADERS, 'priceoye-reviews');
  const html = await res.text();
  const $ = cheerio.load(html);

  const reviews: RawReview[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    let parsed: JsonLdProduct;
    try {
      parsed = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    if (parsed['@type'] !== 'Product' || !Array.isArray(parsed.review)) return;

    for (const r of parsed.review) {
      const text = r.reviewBody?.trim();
      if (!text) continue;
      reviews.push({
        author: r.author?.name && r.author.name !== 'Unknown' ? r.author.name : undefined,
        rating: r.reviewRating?.ratingValue,
        text,
        reviewedAt: r.datePublished,
      });
    }
  });

  return reviews;
}
