'use client';

import NextLink from 'next/link';
import { Box, Button, Flex, Icon, Text, useColorMode, useColorModeValue } from '@chakra-ui/react';
import { MdArrowForward } from 'react-icons/md';
import type { IconType } from 'react-icons';

// Pure-render half of the "instant insight" strip - the one plain-English
// headline pattern established on Overview (InsightBanner.tsx), pulled out
// so Market and Watchlist can reuse the exact same visual chrome (tone
// colours, icon chip, layout) with their own rule-based `computeXInsight`
// function, instead of each page re-implementing the same 90 lines of
// tone/colour-mode plumbing. InsightBanner.tsx keeps Overview's own
// computeTopInsight and its existing default export unchanged - this file
// only holds what every page's insight strip has in common.

export type Tone = 'good' | 'warning' | 'critical' | 'neutral';

export type Insight = {
  tone: Tone;
  icon: IconType;
  headline: string;
  detail: string;
  ctaLabel?: string;
  ctaHref?: string;
};

const TONE_COLORS: Record<Tone, { bg: [string, string]; iconBg: [string, string]; iconColor: [string, string]; accent: [string, string] }> = {
  good: {
    bg: ['#F0FBF6', 'rgba(5, 205, 153, 0.08)'],
    iconBg: ['#DCF7EA', 'rgba(5, 205, 153, 0.16)'],
    iconColor: ['#05966B', '#3DDC97'],
    accent: ['#05966B', '#3DDC97'],
  },
  warning: {
    bg: ['#FFF9EE', 'rgba(255, 181, 71, 0.08)'],
    iconBg: ['#FFEFCF', 'rgba(255, 181, 71, 0.16)'],
    iconColor: ['#B4740A', '#FFB547'],
    accent: ['#B4740A', '#FFB547'],
  },
  critical: {
    bg: ['#FDF1F1', 'rgba(238, 93, 80, 0.08)'],
    iconBg: ['#FBE0DE', 'rgba(238, 93, 80, 0.16)'],
    iconColor: ['#C23A2E', '#EE5D50'],
    accent: ['#C23A2E', '#EE5D50'],
  },
  neutral: {
    bg: ['#F4F5FF', 'whiteAlpha.50'],
    iconBg: ['#E9EAFF', 'whiteAlpha.100'],
    iconColor: ['#4318FF', '#A594FF'],
    accent: ['#4318FF', '#A594FF'],
  },
};

export function InsightStrip({ insight }: { insight: Insight }) {
  // Semantic tone, deliberately separate from the brand purple used
  // elsewhere on the page - colour has to mean "act on this" at a glance,
  // not just "on-brand". Plain light/dark pairs picked by colorMode rather
  // than useColorModeValue per property, since this can render inside a
  // list (Watchlist could show more than one) - four static hook calls per
  // instance regardless of how many tones exist.
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';
  const pick = (pair: [string, string]) => pair[dark ? 1 : 0];
  const c = TONE_COLORS[insight.tone];
  const tone = { bg: pick(c.bg), iconBg: pick(c.iconBg), iconColor: pick(c.iconColor), accent: pick(c.accent) };
  const headlineColor = useColorModeValue('secondaryGray.900', 'white');
  const detailColor = useColorModeValue('secondaryGray.600', 'secondaryGray.400');

  return (
    <Box
      bg={tone.bg}
      borderRadius="20px"
      borderLeft="4px solid"
      borderColor={tone.accent}
      p={{ base: '18px', md: '22px' }}
      mb="20px"
    >
      <Flex align={{ base: 'flex-start', md: 'center' }} justify="space-between" gap="16px" wrap="wrap">
        <Flex align="center" gap="16px">
          <Flex
            align="center"
            justify="center"
            w="48px"
            h="48px"
            borderRadius="14px"
            bg={tone.iconBg}
            flexShrink={0}
          >
            <Icon as={insight.icon} w="24px" h="24px" color={tone.iconColor} />
          </Flex>
          <Box>
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="700" color={headlineColor} lineHeight="1.3">
              {insight.headline}
            </Text>
            <Text fontSize="sm" color={detailColor} mt="2px">
              {insight.detail}
            </Text>
          </Box>
        </Flex>
        {insight.ctaLabel && insight.ctaHref && (
          <Button
            as={NextLink}
            href={insight.ctaHref}
            size="sm"
            variant="ghost"
            rightIcon={<Icon as={MdArrowForward} />}
            color={tone.accent}
            flexShrink={0}
          >
            {insight.ctaLabel}
          </Button>
        )}
      </Flex>
    </Box>
  );
}

export default InsightStrip;
