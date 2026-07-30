'server-only';

import { callGroqJson, GroqNotConfiguredError } from '@/lib/ai/groq-client';

export { GroqNotConfiguredError };

export type CategorySuggestion = {
  categorySlug: string;
  confidence: 'high' | 'medium' | 'low';
};

// Sends the product title + the seller's fixed category list to Groq, gets
// back the single best-matching slug. Llama 3.1 8B was picked specifically
// for this: classifying a title into one of ~12 fixed categories doesn't
// need a heavyweight model, it needs to feel instant while the seller is
// still typing.
export async function suggestCategory(
  title: string,
  categories: { slug: string; name: string }[],
): Promise<CategorySuggestion> {
  const categoryList = categories.map((c) => `${c.slug}: ${c.name}`).join('\n');

  const parsed = await callGroqJson<{ categorySlug?: string; confidence?: string }>({
    temperature: 0,
    system:
      'You classify e-commerce product titles into exactly one category from a fixed list. ' +
      'Reply with strict JSON only: {"categorySlug": "<one of the given slugs>", "confidence": "high"|"medium"|"low"}. ' +
      'If nothing fits well, pick the closest one and use "low" confidence - never invent a slug that is not in the list.',
    user: `Categories:\n${categoryList}\n\nProduct title: "${title}"`,
  });

  const validSlugs = new Set(categories.map((c) => c.slug));
  if (!parsed.categorySlug || !validSlugs.has(parsed.categorySlug)) {
    throw new Error(`Groq returned an unrecognized category slug: ${parsed.categorySlug}`);
  }

  const confidence: CategorySuggestion['confidence'] =
    parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
      ? parsed.confidence
      : 'medium';

  return { categorySlug: parsed.categorySlug, confidence };
}
