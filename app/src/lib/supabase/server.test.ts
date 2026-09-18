import { describe, it, expect, vi, beforeEach } from 'vitest';

// createClient() picks between the cookie-session client (web) and the
// bearer client (mobile) by looking at the request's Authorization header.
// This is the one decision that makes every shared lib function usable from
// a phone, and its failure mode is silent - every seller-scoped query just
// returns [] - so it gets pinned here.

let requestHeaders = new Headers();
let headersThrows = false;

vi.mock('next/headers', () => ({
  headers: async () => {
    if (headersThrows) throw new Error('headers() called outside a request scope');
    return requestHeaders;
  },
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

const ssrCalls: unknown[][] = [];
const jsCalls: unknown[][] = [];

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => {
    ssrCalls.push(args);
    return { kind: 'cookie' };
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    jsCalls.push(args);
    return { kind: 'bearer' };
  },
}));

import { createClient } from './server';

beforeEach(() => {
  requestHeaders = new Headers();
  headersThrows = false;
  ssrCalls.length = 0;
  jsCalls.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

describe('createClient', () => {
  it('uses the bearer client, carrying the token, when the request has Authorization: Bearer', async () => {
    requestHeaders = new Headers({ authorization: 'Bearer tok_123' });

    const client = await createClient();

    expect(client).toEqual({ kind: 'bearer' });
    expect(ssrCalls).toHaveLength(0);
    const opts = jsCalls[0][2] as { global: { headers: { Authorization: string } } };
    expect(opts.global.headers.Authorization).toBe('Bearer tok_123');
  });

  it('uses the cookie client when there is no Authorization header (the web app)', async () => {
    const client = await createClient();

    expect(client).toEqual({ kind: 'cookie' });
    expect(jsCalls).toHaveLength(0);
  });

  it('ignores a non-Bearer Authorization scheme and falls back to cookies', async () => {
    requestHeaders = new Headers({ authorization: 'Basic abc' });

    const client = await createClient();

    expect(client).toEqual({ kind: 'cookie' });
  });

  it('falls back to cookies when headers() is unavailable, unchanged from before', async () => {
    headersThrows = true;

    const client = await createClient();

    expect(client).toEqual({ kind: 'cookie' });
  });
});
