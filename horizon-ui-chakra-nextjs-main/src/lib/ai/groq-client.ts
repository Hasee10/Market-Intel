'server-only';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqNotConfiguredError extends Error {
  constructor() {
    super('GROQ_API_KEY is not set.');
    this.name = 'GroqNotConfiguredError';
  }
}

type GroqJsonOptions = {
  model?: string;
  system: string;
  user: string;
  temperature?: number;
};

// Shared low-level caller behind suggestCategory() and generateReportInsights()
// - both need Groq's JSON mode and the same error-shape handling, no reason
// for two copies of the fetch/parse boilerplate.
export async function callGroqJson<T>({ model = 'llama-3.1-8b-instant', system, user, temperature = 0.4 }: GroqJsonOptions): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned no content');

  return JSON.parse(content) as T;
}

type GroqChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type GroqChatOptions = {
  model?: string;
  messages: GroqChatMessage[];
  temperature?: number;
};

// Plain-text completion (no JSON mode) - for conversational output like the
// assistant widget, where the answer is prose rather than a structured
// field. Separate from callGroqJson rather than a shared wrapper because the
// two request bodies genuinely differ (response_format, multi-turn messages
// vs single system+user) and forcing one signature over both would just add
// branches to a single function.
export async function callGroqChat({ model = 'llama-3.1-8b-instant', messages, temperature = 0.2 }: GroqChatOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, temperature, messages }),
  });

  if (!response.ok) {
    throw new Error(`Groq API request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned no content');

  return content as string;
}
