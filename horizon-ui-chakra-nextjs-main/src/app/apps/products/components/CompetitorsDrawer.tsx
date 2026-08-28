'use client';

import { Fragment, useEffect, useState } from 'react';

import {
  Badge,
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  Icon,
  Link,
  Skeleton,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { MdOutlineOpenInNew, MdOutlineStar, MdExpandMore, MdExpandLess } from 'react-icons/md';

import { IProduct } from '@/types/products';
import { IApiResponse } from '@/types/api-response';

type CompetitorListing = {
  matchedTitle: string;
  matchedPlatformName: string | null;
  matchedPrice: number | null;
  matchedUrl: string;
  rating: number | null;
  ratingCount: number | null;
  soldCount: number | null;
  confidence: number;
  reviewCount: number;
  topReviews: { author: string | null; rating: number | null; text: string }[];
};

type CompetitorsDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  product: IProduct | null;
  /** Matches the reportingCurrency the API converts listing prices into. */
  reportingCurrency: string;
};

const formatCurrency = (amount: number | null, currency: string) =>
  amount == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

const formatRating = (rating: number | null, ratingCount: number | null) => {
  if (rating == null) return '—';
  return ratingCount != null ? `${rating.toFixed(1)} (${ratingCount})` : rating.toFixed(1);
};

// Scraped titles occasionally carry un-decoded HTML entities (e.g.
// "Sorting &amp; Stacking") straight from the source page's markup. Decoding
// via a detached textarea uses the browser's own parser instead of a
// hand-rolled entity table, so it's correct for every entity, not just the
// common ones - safe here because we only ever read `.value` back out as
// plain text, never re-render the decoded string as HTML.
const decodeHtmlEntities = (text: string): string => {
  if (typeof window === 'undefined') return text;
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
};

export function CompetitorsDrawer({ isOpen, onClose, product, reportingCurrency }: CompetitorsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<CompetitorListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const rowHoverBg = useColorModeValue('#FAFAFF', 'whiteAlpha.50');
  const mutedColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');
  const reviewBg = useColorModeValue('gray.50', 'whiteAlpha.50');

  const toggleExpanded = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen || !product) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/products/${product.id}/competitors`)
      .then((res) => res.json())
      .then((data: IApiResponse<CompetitorListing[]>) => {
        if (cancelled) return;
        if (!data.succeeded) {
          setError(data.message || 'Failed to load competitor listings');
          setListings([]);
          return;
        }
        setListings(data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load competitor listings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, product]);

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="lg">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Competitor listings{product ? ` — ${product.title}` : ''}</DrawerHeader>
        <DrawerBody>
          <Text fontSize="sm" color={mutedColor} mb="16px">
            Listings below are in the same category and closely match this product&apos;s title - price isn&apos;t
            used to decide what counts as a match, only shown here for comparison. Daraz listings are other marketplace
            sellers; listings from other platforms are individual retailers stocking a comparable item, not
            competing sellers on the same marketplace.
          </Text>

          {loading && (
            <Stack spacing="12px">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={`competitor-loading-${i}`} height="20px" />
              ))}
            </Stack>
          )}

          {!loading && error && (
            <Text color="red.500" fontSize="sm">
              {error}
            </Text>
          )}

          {!loading && !error && listings.length === 0 && (
            <Text color={mutedColor} fontSize="sm">
              No comparable listings found for this product yet.
            </Text>
          )}

          {!loading && !error && listings.length > 0 && (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Listing</Th>
                    <Th>Platform</Th>
                    <Th isNumeric>Price</Th>
                    <Th isNumeric>Rating</Th>
                    <Th isNumeric>
                      <Tooltip label="Demand proxy (platform-reported), not verified sales">
                        <span>Sold</span>
                      </Tooltip>
                    </Th>
                    <Th>Reviews</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {listings.map((listing, i) => {
                    const title = decodeHtmlEntities(listing.matchedTitle);
                    const isExpanded = expandedRows.has(i);
                    return (
                      <Fragment key={`${listing.matchedUrl}-${i}`}>
                      <Tr _hover={{ bg: rowHoverBg }}>
                        <Td maxW="240px">
                          <Tooltip label={title} openDelay={400}>
                            <Link
                              href={listing.matchedUrl}
                              isExternal
                              fontSize="sm"
                              fontWeight="500"
                              display="flex"
                              alignItems="center"
                              gap="6px"
                              _hover={{ color: 'brand.500', textDecoration: 'none' }}
                            >
                              <Text as="span" noOfLines={2}>
                                {title}
                              </Text>
                              <Icon as={MdOutlineOpenInNew} boxSize="12px" flexShrink={0} color={mutedColor} />
                            </Link>
                          </Tooltip>
                        </Td>
                        <Td fontSize="sm">
                          {listing.matchedPlatformName ? (
                            <Badge colorScheme="brand" variant="subtle" fontSize="10px" borderRadius="6px" px="8px" py="2px">
                              {listing.matchedPlatformName}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td isNumeric fontSize="sm" fontWeight="600">
                          {formatCurrency(listing.matchedPrice, reportingCurrency)}
                        </Td>
                        <Td isNumeric fontSize="sm">
                          {listing.rating != null ? (
                            <Flex align="center" justify="flex-end" gap="4px">
                              <Icon as={MdOutlineStar} boxSize="12px" color="yellow.400" />
                              <Text as="span">{formatRating(listing.rating, listing.ratingCount)}</Text>
                            </Flex>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td isNumeric fontSize="sm" color={mutedColor}>
                          {listing.soldCount == null ? '—' : listing.soldCount.toLocaleString()}
                        </Td>
                        <Td fontSize="sm">
                          {listing.reviewCount > 0 ? (
                            <Flex
                              as="button"
                              align="center"
                              gap="2px"
                              color="brand.500"
                              cursor="pointer"
                              onClick={() => toggleExpanded(i)}
                            >
                              <Text as="span">{listing.reviewCount} review{listing.reviewCount === 1 ? '' : 's'}</Text>
                              <Icon as={isExpanded ? MdExpandLess : MdExpandMore} boxSize="14px" />
                            </Flex>
                          ) : (
                            <Text as="span" color={mutedColor}>
                              —
                            </Text>
                          )}
                        </Td>
                      </Tr>
                      {isExpanded && listing.topReviews.length > 0 && (
                        <Tr>
                          <Td colSpan={6} bg={reviewBg} py="10px">
                            <Stack spacing="8px">
                              {listing.topReviews.map((review, ri) => (
                                <Box key={ri}>
                                  <Flex align="center" gap="6px" mb="2px">
                                    {review.rating != null && (
                                      <Flex align="center" gap="2px">
                                        <Icon as={MdOutlineStar} boxSize="11px" color="yellow.400" />
                                        <Text as="span" fontSize="xs" fontWeight="600">
                                          {review.rating.toFixed(1)}
                                        </Text>
                                      </Flex>
                                    )}
                                    <Text as="span" fontSize="xs" color={mutedColor}>
                                      {review.author ?? 'Anonymous'}
                                    </Text>
                                  </Flex>
                                  <Text fontSize="sm">{decodeHtmlEntities(review.text)}</Text>
                                </Box>
                              ))}
                            </Stack>
                          </Td>
                        </Tr>
                      )}
                      </Fragment>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

export default CompetitorsDrawer;
