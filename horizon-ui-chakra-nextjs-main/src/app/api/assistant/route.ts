import { NextRequest, NextResponse } from 'next/server';

import { answerMarketingQuestion, GroqNotConfiguredError, type AssistantMessage } from '@/lib/ai/marketing-assistant';

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 500;
const FALLBACK_REPLY =
  "I don't have that on file - the fastest way to get a real answer is to sign up (it's free) or reach out through the site's contact options.";

// Public route (see middleware.ts - only /dashboard, /apps, /onboarding are
// gated) since this backs the marketing-site widget, not anything
// seller-specific. No seller identity is read or needed here.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ reply: FALLBACK_REPLY, error: 'Invalid request body' }, { status: 400 });
  }

  const rawMessages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ reply: FALLBACK_REPLY, error: 'messages array is required' }, { status: 400 });
  }

  const messages: AssistantMessage[] = rawMessages
    .slice(-MAX_MESSAGES)
    .filter(
      (m): m is AssistantMessage =>
        typeof m === 'object' &&
        m !== null &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ reply: FALLBACK_REPLY, error: 'A user message is required' }, { status: 400 });
  }

  try {
    const reply = await answerMarketingQuestion(messages);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      // Fails soft to the same "don't know" copy the model itself would give
      // for an out-of-scope question - a visitor should never see a raw
      // config/500 error in a chat bubble.
      return NextResponse.json({ reply: FALLBACK_REPLY });
    }
    return NextResponse.json({ reply: FALLBACK_REPLY, error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
