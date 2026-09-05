import { NextRequest, NextResponse } from 'next/server';

import { answerSellerQuestion, GroqNotConfiguredError, type AssistantMessage } from '@/lib/ai/seller-assistant';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';
import { isRateLimited } from '@/lib/rate-limit';

const MAX_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 500;
const FALLBACK_REPLY = "I couldn't put an answer together just now - try again in a moment.";
const RATE_LIMIT_REPLY = "You're sending questions faster than I can answer - give it a minute and try again.";
// Per-seller, not per-IP (unlike /api/assistant): a session generating this
// traffic IS the seller, not shared/anonymous traffic, so there's no reason
// to be as conservative as the public widget's 12/min.
const RATE_LIMIT_PER_MINUTE = 20;

// Authenticated sibling of /api/assistant, grounded in the calling seller's
// own data (see seller-assistant-context.ts). Deliberately never reads a
// seller/sellerId field from the request body - the seller answered for is
// always whoever getCurrentSeller() resolves from the session cookie, so a
// crafted request body can't make this answer using another seller's data.
export async function POST(request: NextRequest) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (isRateLimited(seller.id, RATE_LIMIT_PER_MINUTE)) {
    return NextResponse.json({ reply: RATE_LIMIT_REPLY, error: 'Rate limit exceeded' }, { status: 429 });
  }

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
    const reply = await answerSellerQuestion(seller, messages);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      // Same soft-fail posture as /api/assistant - a seller should never see
      // a raw config/500 error in a chat bubble.
      return NextResponse.json({ reply: FALLBACK_REPLY });
    }
    return NextResponse.json({ reply: FALLBACK_REPLY, error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
