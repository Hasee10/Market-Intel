import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let currentSeller: any = { id: 'seller1', businessName: 'Test Store', reportingCurrency: 'PKR' };
let rateLimited = false;
const answerSellerQuestionMock = vi.fn(async (..._args: any[]) => 'Here is your answer.');

vi.mock('@/lib/market-intel/seller', () => ({
  getCurrentSeller: async () => currentSeller,
}));

vi.mock('@/lib/rate-limit', () => ({
  isRateLimited: () => rateLimited,
}));

vi.mock('@/lib/ai/seller-assistant', () => ({
  answerSellerQuestion: (...args: any[]) => answerSellerQuestionMock(...args),
  GroqNotConfiguredError: class GroqNotConfiguredError extends Error {},
}));

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/assistant/seller', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  currentSeller = { id: 'seller1', businessName: 'Test Store', reportingCurrency: 'PKR' };
  rateLimited = false;
  answerSellerQuestionMock.mockClear();
});

describe('POST /api/assistant/seller', () => {
  it('returns 401 when there is no authenticated seller', async () => {
    currentSeller = null;

    const response = await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(response.status).toBe(401);
    expect(answerSellerQuestionMock).not.toHaveBeenCalled();
  });

  it('returns 429 when the seller is rate limited', async () => {
    rateLimited = true;

    const response = await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }));

    expect(response.status).toBe(429);
    expect(answerSellerQuestionMock).not.toHaveBeenCalled();
  });

  it('answers using the resolved seller, ignoring any seller field in the request body', async () => {
    const response = await POST(
      makeRequest({ messages: [{ role: 'user', content: 'how is my margin?' }], sellerId: 'someone-elses-id' }),
    );
    const data = await response.json();

    expect(data.reply).toBe('Here is your answer.');
    expect(answerSellerQuestionMock).toHaveBeenCalledWith(
      currentSeller,
      expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'how is my margin?' })]),
    );
  });

  it('falls back to a soft-fail reply when answerSellerQuestion throws', async () => {
    answerSellerQuestionMock.mockRejectedValueOnce(new Error('groq down'));

    const response = await POST(makeRequest({ messages: [{ role: 'user', content: 'hi' }] }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reply).toBeTruthy();
    expect(data.error).toBe('groq down');
  });
});
