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

// Bulk-import sibling of suggestCategory() - one Groq call classifies many
// titles instead of one, since a 5000-row CSV can't afford a round trip per
// row. A single bad/missing index in the response degrades to null for that
// title only, not a thrown error for the whole batch - one row's oddity
// shouldn't cost every other row in the same batch its suggestion.
export async function suggestCategoriesBatch(
  titles: string[],
  categories: { slug: string; name: string }[],
): Promise<(CategorySuggestion | null)[]> {
  if (titles.length === 0) return [];

  const categoryList = categories.map((c) => `${c.slug}: ${c.name}`).join('\n');
  const numberedTitles = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const parsed = await callGroqJson<{ results?: { index?: number; categorySlug?: string; confidence?: string }[] }>({
    temperature: 0,
    system:
      'You classify a numbered list of e-commerce product titles into exactly one category each, from a fixed list. ' +
      'Reply with strict JSON only: {"results": [{"index": <1-based number matching the input>, "categorySlug": "<one of the given slugs>", "confidence": "high"|"medium"|"low"}, ...]}. ' +
      'Include one result per input title. If nothing fits well for a title, pick the closest one and use "low" confidence - never invent a slug that is not in the list.',
    user: `Categories:\n${categoryList}\n\nProduct titles:\n${numberedTitles}`,
  });

  const validSlugs = new Set(categories.map((c) => c.slug));
  const byIndex = new Map<number, CategorySuggestion>();
  for (const r of parsed.results ?? []) {
    if (!r.index || !r.categorySlug || !validSlugs.has(r.categorySlug)) continue;
    const confidence: CategorySuggestion['confidence'] =
      r.confidence === 'high' || r.confidence === 'medium' || r.confidence === 'low' ? r.confidence : 'medium';
    byIndex.set(r.index, { categorySlug: r.categorySlug, confidence });
  }

  return titles.map((_, i) => byIndex.get(i + 1) ?? null);
}
