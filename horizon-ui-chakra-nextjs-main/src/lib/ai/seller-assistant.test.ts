import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGroqChatMock = vi.fn(async (..._args: any[]) => '  Your margin looks healthy.  ');
const buildSellerContextBlockMock = vi.fn(async (..._args: any[]) => 'Store products: 1 item.');

vi.mock('@/lib/ai/groq-client', () => ({
  callGroqChat: (...args: any[]) => callGroqChatMock(...args),
  GroqNotConfiguredError: class GroqNotConfiguredError extends Error {},
}));

vi.mock('@/lib/ai/seller-assistant-context', () => ({
  buildSellerContextBlock: (...args: any[]) => buildSellerContextBlockMock(...args),
}));

import { answerSellerQuestion } from './seller-assistant';

const seller: any = { id: 'seller1', businessName: 'Test Store', reportingCurrency: 'PKR' };

beforeEach(() => {
  callGroqChatMock.mockClear();
  buildSellerContextBlockMock.mockClear();
});

describe('answerSellerQuestion', () => {
  it('trims history to the last 8 messages and 500 chars each before calling Groq', async () => {
    const longMessage = 'x'.repeat(600);
    const history: { role: 'user' | 'assistant'; content: string }[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i === 9 ? longMessage : `message ${i}`,
    }));

    await answerSellerQuestion(seller, history);

    const callArgs: any = callGroqChatMock.mock.calls[0]![0];
    const nonSystemMessages = callArgs.messages.filter((m: any) => m.role !== 'system');
    expect(nonSystemMessages).toHaveLength(8);
    expect(nonSystemMessages[nonSystemMessages.length - 1].content).toHaveLength(500);
  });

  it('includes the context block and the advisory-only instruction in the system prompt', async () => {
    await answerSellerQuestion(seller, [{ role: 'user', content: 'how is my margin?' }]);

    const callArgs: any = callGroqChatMock.mock.calls[0]![0];
    const systemMessage = callArgs.messages.find((m: any) => m.role === 'system');
    expect(systemMessage.content).toContain('Store products: 1 item.');
    expect(systemMessage.content).toContain('read-only and advisory');
  });

  it('passes the latest user message to the context builder for the per-product heuristic', async () => {
    await answerSellerQuestion(seller, [
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'latest question' },
    ]);

    expect(buildSellerContextBlockMock).toHaveBeenCalledWith(seller, 'latest question');
  });

  it('trims the reply', async () => {
    const reply = await answerSellerQuestion(seller, [{ role: 'user', content: 'hi' }]);
    expect(reply).toBe('Your margin looks healthy.');
  });
});
