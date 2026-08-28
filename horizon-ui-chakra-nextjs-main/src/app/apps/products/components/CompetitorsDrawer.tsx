'use client';

import { useEffect, useState } from 'react';

import {
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
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

export function CompetitorsDrawer({ isOpen, onClose, product, reportingCurrency }: CompetitorsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<CompetitorListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  const rowHoverBg = useColorModeValue('#FAFAFF', 'whiteAlpha.50');
  const mutedColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');

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
            Listings below are in the same category and within 15% of your price - the price range that actually
            competes for the same buyer, regardless of whether the product name matches yours. Daraz listings are
            other marketplace sellers; listings from other platforms are individual retailers stocking a
            comparable item, not competing sellers on the same marketplace.
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
                  </Tr>
                </Thead>
                <Tbody>
                  {listings.map((listing, i) => (
                    <Tr key={`${listing.matchedUrl}-${i}`} _hover={{ bg: rowHoverBg }}>
                      <Td maxW="220px">
                        <Link href={listing.matchedUrl} isExternal noOfLines={2} fontSize="sm">
                          {listing.matchedTitle}
                        </Link>
                      </Td>
                      <Td fontSize="sm">{listing.matchedPlatformName ?? '—'}</Td>
                      <Td isNumeric fontSize="sm">
                        {formatCurrency(listing.matchedPrice, reportingCurrency)}
                      </Td>
                      <Td isNumeric fontSize="sm">
                        {formatRating(listing.rating, listing.ratingCount)}
                      </Td>
                      <Td isNumeric fontSize="sm">
                        {listing.soldCount == null ? '—' : listing.soldCount}
                      </Td>
                    </Tr>
                  ))}
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
