import { describe, it, expect, vi, beforeEach } from 'vitest';

// Covers the timeout/retry wrapper added around both callGroqJson and
// callGroqChat - previously a hung request had no bound at all (plain
// fetch, no AbortController) and a transient 429/5xx failed the whole
// request on the first try. fetch itself is mocked per-test; process.env
// is set directly since 'server-only' modules don't need extra mocking to
// import under vitest's node environment (see price-history.test.ts) - the
// key is only read inside each call, not at import time, so setting it
// after the import is fine.

process.env.GROQ_API_KEY = 'test-key';

import { callGroqChat, callGroqJson } from './groq-client';


function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function groqPayload(content: string) {
  return { choices: [{ message: { content } }] };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('callGroqChat', () => {
  it('returns the reply on a clean first attempt, no retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(groqPayload('hello')));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGroqChat({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('hello');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on a 429 and succeeds on the second attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429))
      .mockResolvedValueOnce(jsonResponse(groqPayload('recovered')));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGroqChat({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once on a 500 and succeeds on the second attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'server error' }, 500))
      .mockResolvedValueOnce(jsonResponse(groqPayload('recovered')));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGroqChat({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 401 - fails fast on a non-retryable status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad key' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGroqChat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow('Groq API request failed: 401');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once on a network failure, then throws if it fails again', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGroqChat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(/Groq API request failed/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts a hung request via the timeout and surfaces a clear error after both attempts', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const promise = callGroqChat({ messages: [{ role: 'user', content: 'hi' }] });
    // Attach the rejection assertion before advancing any timers, so
    // there's no window where the rejection is briefly unhandled (vitest
    // flags that even once a handler is attached moments later).
    const assertion = expect(promise).rejects.toThrow(/timed out after 15000ms \(2 attempts\)/);
    // First attempt's 15s timeout, then the 300ms retry delay, then the
    // second attempt's 15s timeout - advance past all of it.
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(15_000);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe('callGroqJson', () => {
  it('parses JSON content on a clean first attempt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(groqPayload('{"categorySlug":"gadgets"}')));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callGroqJson<{ categorySlug: string }>({ system: 'sys', user: 'usr' });

    expect(result).toEqual({ categorySlug: 'gadgets' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
