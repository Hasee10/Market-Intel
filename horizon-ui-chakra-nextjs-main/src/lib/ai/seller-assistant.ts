'server-only';

import { callGroqChat, GroqNotConfiguredError } from '@/lib/ai/groq-client';
import { buildSellerContextBlock } from '@/lib/ai/seller-assistant-context';
import type { Seller } from '@/lib/market-intel/seller';

export { GroqNotConfiguredError };

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };

const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 500;

// Advisory-only, stated up front in the prompt: this is the platform's
// stated posture ("easing decisions, not automating them away from the
// owner"), not just a nicety. The real enforcement is mechanical, not
// prompt-level - callGroqChat() below is a plain completion with no
// tools/function-calling wired up, so the model has no way to invoke a
// mutating endpoint even if asked to. This instruction just keeps its
// *wording* honest about what it did.
function buildSellerAssistantSystemPrompt(seller: Seller, contextBlock: string): string {
  return `You are Ryvl's seller assistant, answering questions for ${seller.businessName} using only the data below (reporting currency: ${seller.reportingCurrency}).

You are read-only and advisory. You explain data and suggest actions in prose - you never claim to have changed a price, updated a listing, sent an alert, or performed any action in the seller's store. If asked to "do" something, explain what you'd recommend and how they can do it themselves in the app.

If the data below doesn't cover what's asked, say so plainly instead of guessing.

Your reply is shown as plain text in a narrow chat bubble, not a rendered document - never use markdown (no **bold**, no # headings, no pipe-delimited tables, no markdown bullet lists). For a short list, write one item per line with a plain dash. For anything with several fields per item (like a product list), write each as a short sentence or "Label: value, value, value" - never a table, which won't render and will show as raw pipe characters.

${contextBlock}`;
}

// Authenticated, seller-aware sibling of marketing-assistant.ts's
// answerMarketingQuestion(). Same history-trimming shape, but the system
// prompt is built fresh per request from the seller's own data
// (buildSellerContextBlock) instead of a static FAQ sheet.
export async function answerSellerQuestion(seller: Seller, history: AssistantMessage[]): Promise<string> {
  const trimmedHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  const latestUserMessage = [...trimmedHistory].reverse().find((m) => m.role === 'user')?.content ?? '';
  const contextBlock = await buildSellerContextBlock(seller, latestUserMessage);

  const reply = await callGroqChat({
    temperature: 0.2,
    messages: [{ role: 'system', content: buildSellerAssistantSystemPrompt(seller, contextBlock) }, ...trimmedHistory],
  });

  return reply.trim();
}
