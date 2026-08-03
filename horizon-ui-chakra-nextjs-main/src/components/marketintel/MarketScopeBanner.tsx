'use client';

import { Badge, Box, Flex, Icon, Link as ChakraLink, Text, Tooltip, useColorModeValue } from '@chakra-ui/react';
import Link from 'next/link';
import { MdOutlineTune, MdOutlineWarningAmber } from 'react-icons/md';

import { PATH_DASHBOARD } from '@/lib/paths';
import type { MarketScopeSummary } from '@/lib/market-intel/market-definition';

// ROADMAP.md C2, Block 1 of the framework. Every number on an analysis page is
// computed against *some* definition of "the market". Until now that definition
// was a regex in a source file - the seller could not see it, question it, or
// change it, which meant they had to take the median on trust. This strip is
// the definition, echoed back wherever those numbers are shown, with a link to
// go change it.
//
// It also has to be honest when the answer is nothing. Rendering a blank
// dashboard because a category has zero scraped coverage looks like a bug and
// teaches sellers to distrust the product; saying so plainly, and saying why,
// does not.

export type { MarketScopeSummary };

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function priceBandLabel(summary: MarketScopeSummary): string | null {
  const { priceMin, priceMax, priceCurrency } = summary;
  if (priceMin == null && priceMax == null) return null;
  if (priceMin != null && priceMax != null) {
    return `${formatMoney(priceMin, priceCurrency)} – ${formatMoney(priceMax, priceCurrency)}`;
  }
  if (priceMin != null) return `above ${formatMoney(priceMin, priceCurrency)}`;
  return `under ${formatMoney(priceMax as number, priceCurrency)}`;
}

export function MarketScopeBanner({ summary }: { summary: MarketScopeSummary }) {
  const border = useColorModeValue('secondaryGray.300', 'whiteAlpha.200');
  const bg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const mutedColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const warnColor = useColorModeValue('orange.500', 'orange.300');

  const total = summary.productCount + summary.listingCount;
  const band = priceBandLabel(summary);
  const empty = total === 0;

  const facets: { label: string; value: string }[] = [];
  if (summary.segmentLabels.length > 0 && summary.segmentLabels.length < summary.totalSegmentCount) {
    facets.push({ label: 'Segments', value: summary.segmentLabels.join(', ') });
  }
  if (band) facets.push({ label: 'Price band', value: band });
  if (summary.brands.length > 0) facets.push({ label: 'Brands', value: summary.brands.join(', ') });
  if (summary.cities.length > 0) facets.push({ label: 'Cities', value: summary.cities.join(', ') });

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={empty ? warnColor : border}
      borderRadius="16px"
      px="20px"
      py="14px"
      mb="20px"
    >
      <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'flex-start', md: 'center' }} gap="10px">
        <Icon
          as={empty ? MdOutlineWarningAmber : MdOutlineTune}
          w="20px"
          h="20px"
          color={empty ? warnColor : mutedColor}
          flexShrink={0}
        />

        <Box flex="1">
          {empty ? (
            <Text fontSize="sm" color={textColor} fontWeight="600">
              No scraped listings match your market definition yet.
            </Text>
          ) : (
            <Text fontSize="sm" color={textColor}>
              <Text as="span" fontWeight="700">
                {total.toLocaleString()}
              </Text>{' '}
              {total === 1 ? 'listing' : 'listings'} across{' '}
              <Text as="span" fontWeight="700">
                {summary.platformNames.length}
              </Text>{' '}
              {summary.platformNames.length === 1 ? 'platform' : 'platforms'} match your definition of{' '}
              <Text as="span" fontWeight="700">
                {summary.categoryName}
              </Text>
              .
            </Text>
          )}

          {empty ? (
            <Text fontSize="xs" color={mutedColor} mt="4px">
              {summary.hasTaxonomy
                ? 'The categories mapped to this market have no live scraped rows right now — either your filters are too narrow, or the sources covering them have not returned data yet. Every figure below will be blank until that changes.'
                : 'No scraped source covers this category yet, so there is nothing to compare against. This is a data-coverage gap, not a filter you can widen.'}
            </Text>
          ) : (
            <Flex wrap="wrap" gap="6px" mt="6px" align="center">
              <Tooltip label={summary.platformNames.join(', ')} placement="top">
                <Badge colorScheme="brand" variant="subtle" fontSize="10px" textTransform="none">
                  {summary.platformNames.slice(0, 3).join(', ')}
                  {summary.platformNames.length > 3 ? ` +${summary.platformNames.length - 3}` : ''}
                </Badge>
              </Tooltip>
              {facets.map((facet) => (
                <Badge key={facet.label} colorScheme="gray" variant="subtle" fontSize="10px" textTransform="none">
                  {facet.label}: {facet.value}
                </Badge>
              ))}
              {summary.isDefault && facets.length === 0 && (
                <Text fontSize="xs" color={mutedColor}>
                  Using the default scope — every mapped segment, no price band.
                </Text>
              )}
            </Flex>
          )}
        </Box>

        <ChakraLink
          as={Link}
          href={PATH_DASHBOARD.marketDefinition}
          fontSize="sm"
          fontWeight="600"
          color="brand.500"
          flexShrink={0}
          _hover={{ textDecoration: 'underline' }}
        >
          {summary.isDefault ? 'Define your market' : 'Edit definition'}
        </ChakraLink>
      </Flex>
    </Box>
  );
}

export default MarketScopeBanner;
