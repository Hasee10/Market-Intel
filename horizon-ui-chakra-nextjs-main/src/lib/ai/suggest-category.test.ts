import { describe, it, expect, vi, beforeEach } from 'vitest';

let groqJsonResponse: any = { results: [] };
const callGroqJsonMock = vi.fn(async (..._args: any[]) => groqJsonResponse);

vi.mock('@/lib/ai/groq-client', () => ({
  callGroqJson: (...args: any[]) => callGroqJsonMock(...args),
  GroqNotConfiguredError: class GroqNotConfiguredError extends Error {},
}));

import { suggestCategoriesBatch } from './suggest-category';

const categories = [
  { slug: 'mobiles-and-electronics', name: 'Mobiles & Electronics' },
  { slug: 'home-and-kitchen', name: 'Home & Kitchen' },
];

beforeEach(() => {
  callGroqJsonMock.mockClear();
  groqJsonResponse = { results: [] };
});

describe('suggestCategoriesBatch', () => {
  it('returns an empty array without calling Groq for an empty title list', async () => {
    const result = await suggestCategoriesBatch([], categories);
    expect(result).toEqual([]);
    expect(callGroqJsonMock).not.toHaveBeenCalled();
  });

  it('maps each result back to its 1-based index', async () => {
    groqJsonResponse = {
      results: [
        { index: 1, categorySlug: 'mobiles-and-electronics', confidence: 'high' },
        { index: 2, categorySlug: 'home-and-kitchen', confidence: 'low' },
      ],
    };

    const result = await suggestCategoriesBatch(['iPhone 15', 'Non-stick pan'], categories);

    expect(result).toEqual([
      { categorySlug: 'mobiles-and-electronics', confidence: 'high' },
      { categorySlug: 'home-and-kitchen', confidence: 'low' },
    ]);
  });

  it('leaves a title null when its index is missing from the response, without throwing', async () => {
    groqJsonResponse = {
      results: [{ index: 1, categorySlug: 'mobiles-and-electronics', confidence: 'high' }],
    };

    const result = await suggestCategoriesBatch(['iPhone 15', 'Non-stick pan'], categories);

    expect(result[0]).toEqual({ categorySlug: 'mobiles-and-electronics', confidence: 'high' });
    expect(result[1]).toBeNull();
  });

  it('leaves a title null when its slug is not in the valid set, without throwing', async () => {
    groqJsonResponse = {
      results: [{ index: 1, categorySlug: 'not-a-real-slug', confidence: 'high' }],
    };

    const result = await suggestCategoriesBatch(['iPhone 15'], categories);

    expect(result[0]).toBeNull();
  });

  it('defaults confidence to medium when Groq omits it', async () => {
    groqJsonResponse = {
      results: [{ index: 1, categorySlug: 'mobiles-and-electronics' }],
    };

    const result = await suggestCategoriesBatch(['iPhone 15'], categories);

    expect(result[0]).toEqual({ categorySlug: 'mobiles-and-electronics', confidence: 'medium' });
  });
});
