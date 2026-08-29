'use client';

import NextLink from 'next/link';
import { Box, Button, Flex, Icon, Text, useColorMode, useColorModeValue } from '@chakra-ui/react';
import {
  MdOutlineTrendingUp,
  MdOutlineTrendingDown,
  MdOutlineInventory2,
  MdOutlineCheckCircle,
  MdArrowForward,
} from 'react-icons/md';

import { PATH_APPS } from '@/lib/paths';
import type { StatItem } from '@/components/marketintel/StatsGrid';
import type { OrderAnomaly } from '@/lib/market-intel/anomalies';
import type { RevenueForecast } from '@/lib/market-intel/forecast';

// The "instant insight" strip: one plain-English sentence, not a chart the
// seller has to interpret themselves - most of this product's users are
// non-technical retailers, not analysts. Everything it draws from
// (statsData, the revenue anomaly, the forecast) is already fetched on
// OverviewPage for the existing StatsGrid/alert/forecast card - this adds
// zero new network round trips, just one rule-based pass over data already
// in memory to decide which single thing is worth saying first.
//
// Rule-based on purpose, same posture as pricing-recommendation.ts: a
// seller acts on this, so it has to be traceable to a real number, not an
// LLM guess. Priority order (most urgent/actionable first):
//   1. A revenue anomaly (spike or drop) - already computed server-side by
//      detectOwnRevenueAnomalies, a real statistical outlier, not noise.
//   2. Low stock - operational and time-sensitive; ignoring it costs sales.
//   3. A meaningful revenue swing vs last month (>=5%, and only when the
//      underlying diff wasn't null - see the near-zero-baseline guard in
//      app/api/ecommerce/stats/route.ts; a null diff means "not a real
//      comparison" and must never be spoken as if it were one).
//   4. A Premium-only revenue forecast trend, if the seller has it.
//   5. A calm fallback - "nothing unusual" is itself an answer, not an
//      empty space. Never leave this strip blank.

type Tone = 'good' | 'warning' | 'critical' | 'neutral';

type Insight = {
  tone: Tone;
  icon: typeof MdOutlineTrendingUp;
  headline: string;
  detail: string;
  ctaLabel?: string;
  ctaHref?: string;
};

function formatMoney(v: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const REVENUE_SWING_THRESHOLD_PCT = 5;

export function computeTopInsight({
  stats,
  anomaly,
  forecast,
  currency,
}: {
  stats: StatItem[];
  anomaly: OrderAnomaly | undefined;
  forecast: RevenueForecast | null;
  currency: string;
}): Insight {
  if (anomaly) {
    const isDrop = anomaly.direction === 'drop';
    return {
      tone: isDrop ? 'critical' : 'good',
      icon: isDrop ? MdOutlineTrendingDown : MdOutlineTrendingUp,
      headline: `Revenue ${isDrop ? 'dropped sharply' : 'spiked'} on ${formatDate(anomaly.date)}`,
      detail: `${formatMoney(anomaly.revenue, currency)} that day, vs your usual ${formatMoney(anomaly.expectedRange[0], currency)}–${formatMoney(anomaly.expectedRange[1], currency)} range.`,
      ctaLabel: 'View orders',
      ctaHref: PATH_APPS.orders,
    };
  }

  const lowStock = stats.find((s) => s.title === 'Low Stock Products');
  // StatItem.value is a formatted display string (toLocaleString()), which
  // adds thousands separators above 999 - strip them before parsing, or a
  // low-stock count of 1,000+ would silently become NaN here.
  const lowStockCount = lowStock ? Number(lowStock.value.replace(/,/g, '')) : 0;
  if (lowStockCount > 0) {
    return {
      tone: 'warning',
      icon: MdOutlineInventory2,
      headline: `${lowStockCount} product${lowStockCount === 1 ? '' : 's'} running low on stock`,
      detail: 'Restock soon - a stock-out is a sale you can\'t get back.',
      ctaLabel: 'View products',
      ctaHref: PATH_APPS.products.root,
    };
  }

  const revenue = stats.find((s) => s.title === 'Revenue (30d)');
  if (revenue?.diff != null && Math.abs(revenue.diff) >= REVENUE_SWING_THRESHOLD_PCT) {
    const up = revenue.diff > 0;
    return {
      tone: up ? 'good' : 'warning',
      icon: up ? MdOutlineTrendingUp : MdOutlineTrendingDown,
      headline: `Revenue is ${up ? 'up' : 'down'} ${Math.abs(revenue.diff)}% vs last month`,
      detail: up ? 'Whatever you changed, it\'s working.' : 'Worth checking what changed this period.',
    };
  }

  if (forecast && forecast.trendDirection !== 'flat') {
    const up = forecast.trendDirection === 'up';
    return {
      tone: up ? 'good' : 'warning',
      icon: up ? MdOutlineTrendingUp : MdOutlineTrendingDown,
      headline: `Revenue is projected to keep ${up ? 'climbing' : 'declining'}`,
      detail: 'Based on the trend in your last 60 days of orders.',
    };
  }

  return {
    tone: 'neutral',
    icon: MdOutlineCheckCircle,
    headline: 'Nothing unusual to flag right now',
    detail: 'Revenue, stock, and orders are all tracking normally.',
  };
}

export function InsightBanner(props: {
  stats: StatItem[];
  anomaly: OrderAnomaly | undefined;
  forecast: RevenueForecast | null;
  currency: string;
}) {
  const insight = computeTopInsight(props);

  // Semantic tone, deliberately separate from the brand purple used
  // everywhere else on the page - this is the one place on Overview where
  // color has to mean "act on this" at a glance, not just "on-brand".
  // Plain light/dark pairs picked by colorMode rather than 16
  // useColorModeValue calls (one per tone x property) on every render -
  // this only needs the one tone actually in use.
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';
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

export default InsightBanner;
