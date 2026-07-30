'server-only';

// Groq was picked specifically for this: classifying a product title into
// one of ~12 fixed categories doesn't need a heavyweight model, it needs to
// feel instant while the seller is still typing. Llama 3.1 8B on Groq's
// inference stack is fast enough for that; Mistral/OpenRouter would add
// latency without adding accuracy for a task this narrow.
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export type CategorySuggestion = {
  categorySlug: string;
  confidence: 'high' | 'medium' | 'low';
};

export class GroqNotConfiguredError extends Error {
  constructor() {
    super('GROQ_API_KEY is not set - AI category suggestions are disabled until it is.');
    this.name = 'GroqNotConfiguredError';
  }
}

// Sends the product title + the seller's fixed category list to Groq, gets
// back the single best-matching slug. Uses JSON mode so the response is
// parseable without regex-scraping free-form text.
export async function suggestCategory(
  title: string,
  categories: { slug: string; name: string }[],
): Promise<CategorySuggestion> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const categoryList = categories.map((c) => `${c.slug}: ${c.name}`).join('\n');

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You classify e-commerce product titles into exactly one category from a fixed list. ' +
            'Reply with strict JSON only: {"categorySlug": "<one of the given slugs>", "confidence": "high"|"medium"|"low"}. ' +
            'If nothing fits well, pick the closest one and use "low" confidence - never invent a slug that is not in the list.',
        },
        {
          role: 'user',
          content: `Categories:\n${categoryList}\n\nProduct title: "${title}"`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned no content');

  const parsed = JSON.parse(content) as { categorySlug?: string; confidence?: string };
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
