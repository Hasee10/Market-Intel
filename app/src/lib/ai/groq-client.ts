'server-only';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Groq retires chat models over time (the previous default,
// llama-3.1-8b-instant, now 404s with "model_not_found" - confirmed
// 2026-08-29 via a direct API call, not assumed). Check
// https://console.groq.com/docs/models or GET /openai/v1/models for what's
// currently active before assuming a model id still works.

export class GroqNotConfiguredError extends Error {
  constructor() {
    super('GROQ_API_KEY is not set.');
    this.name = 'GroqNotConfiguredError';
  }
}

// Neither caller previously bounded how long a hung Groq request could sit
// - a stalled connection would hold the request open indefinitely rather
// than erroring, since plain fetch() has no default timeout. 15s per
// attempt, one retry on the failure classes actually worth retrying
// (timeout, network failure, 429, 5xx) - a 4xx (bad key, bad request) is
// retried at most once too since Groq's own transient auth hiccups aren't
// distinguishable from a real bad key without another round trip, but a
// second identical 401 fails fast rather than looping.
const GROQ_TIMEOUT_MS = 15_000;
const GROQ_RETRY_DELAY_MS = 300;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

// Shared fetch behind both callGroqJson/callGroqChat - timeout via
// AbortController (fetch has no built-in one), one retry only for the
// failure classes a second attempt can plausibly fix. A non-retryable 4xx
// still throws immediately on the first attempt, unchanged from before.
async function fetchGroqWithRetry(body: unknown, apiKey: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok && isRetryableStatus(response.status) && attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, GROQ_RETRY_DELAY_MS));
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, GROQ_RETRY_DELAY_MS));
        continue;
      }
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      throw new Error(isTimeout ? `Groq API request timed out after ${GROQ_TIMEOUT_MS}ms (2 attempts)` : `Groq API request failed: ${(err as Error).message}`);
    }
  }

  // Unreachable (the loop always returns or throws), but keeps TypeScript
  // from seeing a possible undefined return.
  throw lastError instanceof Error ? lastError : new Error('Groq API request failed');
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
export async function callGroqJson<T>({ model = 'openai/gpt-oss-20b', system, user, temperature = 0.4 }: GroqJsonOptions): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const response = await fetchGroqWithRetry(
    {
      model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    apiKey,
  );

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
export async function callGroqChat({ model = 'openai/gpt-oss-20b', messages, temperature = 0.2 }: GroqChatOptions): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new GroqNotConfiguredError();

  const response = await fetchGroqWithRetry({ model, temperature, messages }, apiKey);

  if (!response.ok) {
    throw new Error(`Groq API request failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned no content');

  return content as string;
}
