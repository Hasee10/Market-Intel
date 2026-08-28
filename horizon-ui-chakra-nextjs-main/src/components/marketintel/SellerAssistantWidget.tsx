'use client';

import {
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  Text,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import { MdChatBubble, MdClose, MdSend } from 'react-icons/md';
import { useEffect, useRef, useState } from 'react';

import { Reveal } from 'components/reactbits/Reveal';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const STARTER_QUESTIONS = [
  "How's my margin looking on my top products?",
  'Which competitors are undercutting me right now?',
  'Is anything on my watchlist out of stock?',
];

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "Hi - ask me about your products, margins, or how your competitors are pricing. I'll answer using your own store and market data.",
};

// Dashboard-embedded sibling of the marketing site's AssistantWidget - same
// floating-button/panel shape, but posts to /api/assistant/seller (session-
// authenticated, grounded in this seller's own data) instead of the public,
// unauthenticated /api/assistant. Mounted once in AdminShell so it's on
// every authenticated page, not per-route.
export function SellerAssistantWidget() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const panelBg = useColorModeValue('white', 'navy.800');
  const panelBorder = useColorModeValue('gray.100', 'whiteAlpha.100');
  const heading = useColorModeValue('#111C4E', 'white');
  const body = useColorModeValue('gray.600', 'secondaryGray.400');
  const bubbleUserBg = 'linear-gradient(135deg, #4318FF 0%, #7B61FF 100%)';
  const bubbleAssistantBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const inputBg = useColorModeValue('white', 'navy.900');

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
      const response = await fetch('/api/assistant/seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING) }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong reaching the assistant - please try again in a moment.' },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Box position="fixed" bottom={{ base: '20px', md: '28px' }} right={{ base: '20px', md: '28px' }} zIndex="40">
      {isOpen && (
        <Reveal duration={250}>
          <Flex
            direction="column"
            w={{ base: 'calc(100vw - 40px)', md: '360px' }}
            maxW="360px"
            h="480px"
            maxH="70vh"
            bg={panelBg}
            border="1px solid"
            borderColor={panelBorder}
            borderRadius="20px"
            boxShadow="0px 24px 48px rgba(17, 28, 78, 0.18)"
            mb="16px"
            overflow="hidden"
          >
            <Flex
              align="center"
              justify="space-between"
              px="20px"
              py="16px"
              bg="linear-gradient(135deg, #4318FF 0%, #7B61FF 100%)"
            >
              <Box>
                <Text fontWeight="700" fontSize="sm" color="white">
                  Ryvl Assistant
                </Text>
                <Text fontSize="xs" color="whiteAlpha.700">
                  Grounded in your store &amp; market data
                </Text>
              </Box>
              <IconButton
                aria-label="Close assistant"
                icon={<MdClose />}
                size="sm"
                variant="ghost"
                color="white"
                _hover={{ bg: 'whiteAlpha.200' }}
                onClick={onClose}
              />
            </Flex>

            <Flex direction="column" flex="1" overflowY="auto" px="16px" py="16px" gap="12px" ref={scrollRef}>
              {messages.map((m, i) => (
                <Flex key={i} justify={m.role === 'user' ? 'flex-end' : 'flex-start'}>
                  <Box
                    maxW="85%"
                    px="14px"
                    py="10px"
                    borderRadius="14px"
                    bg={m.role === 'user' ? bubbleUserBg : bubbleAssistantBg}
                    color={m.role === 'user' ? 'white' : heading}
                    fontSize="sm"
                    lineHeight="1.5"
                  >
                    {m.content}
                  </Box>
                </Flex>
              ))}
              {isSending && (
                <Flex justify="flex-start">
                  <Box px="14px" py="10px" borderRadius="14px" bg={bubbleAssistantBg} color={body} fontSize="sm">
                    Thinking…
                  </Box>
                </Flex>
              )}
              {messages.length === 1 && (
                <Flex direction="column" gap="8px" mt="4px">
                  {STARTER_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      size="sm"
                      variant="outline"
                      justifyContent="flex-start"
                      fontWeight="500"
                      fontSize="xs"
                      whiteSpace="normal"
                      textAlign="left"
                      h="auto"
                      py="8px"
                      onClick={() => sendMessage(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </Flex>
              )}
            </Flex>

            <Flex
              as="form"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              px="12px"
              py="12px"
              borderTop="1px solid"
              borderColor={panelBorder}
              gap="8px"
              bg={inputBg}
            >
              <Input
                size="sm"
                placeholder="Ask about your products, margins, competitors…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                borderRadius="12px"
                isDisabled={isSending}
              />
              <IconButton
                aria-label="Send"
                icon={<MdSend />}
                size="sm"
                type="submit"
                variant="brand"
                borderRadius="12px"
                isDisabled={isSending || !input.trim()}
              />
            </Flex>
          </Flex>
        </Reveal>
      )}

      <IconButton
        aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
        icon={isOpen ? <MdClose size="24px" /> : <MdChatBubble size="24px" />}
        onClick={isOpen ? onClose : onOpen}
        w="60px"
        h="60px"
        borderRadius="full"
        bg="linear-gradient(135deg, #868CFF 0%, #4318FF 100%)"
        color="white"
        border="1px solid"
        borderColor="#6A53FF"
        boxShadow="0px 12px 24px rgba(67, 24, 255, 0.35)"
        _hover={{ transform: 'translateY(-2px)', boxShadow: '0px 16px 32px rgba(67, 24, 255, 0.45)' }}
        transition="all 0.2s ease"
      />
    </Box>
  );
}

export default SellerAssistantWidget;
