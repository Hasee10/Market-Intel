'server-only';

import { callGroqChat, GroqNotConfiguredError } from '@/lib/ai/groq-client';
import { buildAssistantSystemPrompt } from '@/lib/ai/assistant-knowledge';

export { GroqNotConfiguredError };

export type AssistantMessage = { role: 'user' | 'assistant'; content: string };

const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 500;

// Answers a visitor's question using only buildAssistantSystemPrompt()'s
// facts. Grounding here is entirely prompt-based (no retrieval step) because
// the knowledge base is small enough (a dozen FAQs, tier/feature lists) to
// paste in full every request rather than build a vector-search step for -
// that would be real infrastructure for a fact sheet this size.
export async function answerMarketingQuestion(history: AssistantMessage[]): Promise<string> {
  const trimmedHistory = history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  const reply = await callGroqChat({
    temperature: 0.2,
    messages: [{ role: 'system', content: buildAssistantSystemPrompt() }, ...trimmedHistory],
  });

  return reply.trim();
}
