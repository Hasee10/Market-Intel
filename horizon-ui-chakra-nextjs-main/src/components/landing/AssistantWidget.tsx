'use client';

import { MdChatBubble, MdClose, MdSend } from 'react-icons/md';
import { useEffect, useRef, useState } from 'react';

import { FAQS } from '@/lib/ai/assistant-knowledge';
import { Reveal } from 'components/reactbits/Reveal';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const STARTER_QUESTIONS = FAQS.slice(0, 3).map((f) => f.q);

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    "Hi - I can answer questions about Ryvl's marketplaces, pricing tiers, and how peer benchmarking works. Ask away, or pick one below.",
};

// Floating support widget for the public marketing site. Answers come from
// /api/assistant, which is grounded entirely in assistant-knowledge.ts - the
// same facts already published on Pricing/Trust/How it works, not the
// model's general knowledge. See marketing-assistant.ts for the prompt.
export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const next = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(next);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING) }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong reaching the assistant - please try again in a moment.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="font-manrope fixed bottom-5 right-5 z-40 md:bottom-7 md:right-7">
      {isOpen && (
        <Reveal duration={250}>
          <div className="mb-4 flex h-[480px] max-h-[70vh] w-[calc(100vw-40px)] max-w-[360px] flex-col overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-[0_24px_48px_rgba(17,28,78,0.18)] dark:border-white/10 dark:bg-gray-900">
            <div className="flex items-center justify-between bg-gradient-to-br from-[#4318FF] to-[#7B61FF] px-5 py-4">
              <div>
                <p className="text-sm font-bold text-white">Ryvl Assistant</p>
                <p className="text-xs text-white/70">Grounded in Ryvl&apos;s published product info</p>
              </div>
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setIsOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/20"
              >
                <MdClose className="size-[18px]" />
              </button>
            </div>

            <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {/* whitespace-pre-wrap is load-bearing, not cosmetic: the model
                      is told to separate list items with real newlines, and the
                      CSS default (normal) collapses every one of them into a
                      run-on paragraph. */}
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 text-sm leading-normal ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-[#4318FF] to-[#7B61FF] text-white'
                        : 'bg-gray-50 text-[#111C4E] dark:bg-white/10 dark:text-white'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-[14px] bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 dark:bg-white/10 dark:text-gray-400">
                    Thinking&hellip;
                  </div>
                </div>
              )}

              {messages.length === 1 && (
                <div className="mt-1 flex flex-col gap-2">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:border-[#4318FF] hover:text-[#4318FF] dark:border-gray-700 dark:text-gray-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex gap-2 border-t border-gray-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-gray-950"
            >
              <input
                type="text"
                placeholder="Ask a question…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isSending}
                className="h-9 flex-1 rounded-xl border border-gray-200 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#4318FF] focus:outline-none focus:ring-2 focus:ring-[#4318FF]/20 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={isSending || !input.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#4318FF] text-white transition-colors hover:bg-[#3812DB] disabled:opacity-40"
              >
                <MdSend className="size-[18px]" />
              </button>
            </form>
          </div>
        </Reveal>
      )}

      <button
        type="button"
        aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
        onClick={() => setIsOpen((v) => !v)}
        className="flex size-[60px] items-center justify-center rounded-full border border-[#6A53FF] bg-gradient-to-br from-[#868CFF] to-[#4318FF] text-white shadow-[0_12px_24px_rgba(67,24,255,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(67,24,255,0.45)]"
      >
        {isOpen ? <MdClose size={24} /> : <MdChatBubble size={24} />}
      </button>
    </div>
  );
}

export default AssistantWidget;
