'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';

import {
  Badge,
  Box,
  Button,
  Flex,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Link as ChakraLink,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  IconButton,
  useColorModeValue,
  useToast,
} from '@chakra-ui/react';
import {
  MdDelete,
  MdAdd,
  MdSearch,
  MdOutlinePriceCheck,
  MdOutlineNotificationsActive,
  MdOutlineVisibility,
  MdOutlineCheckCircle,
} from 'react-icons/md';
import Card from 'components/card/Card';

import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import { PageHeader } from '@/components/marketintel/PageHeader';
import type { Watchlist, WatchlistItem, ProductSearchResult } from '@/lib/market-intel/watchlists';
import type { Notification } from '@/lib/notifications/list';

// Same instant-insight pattern as Overview/Market (InsightStrip.tsx) - one
// plain-English headline instead of asking the seller to read a list.
// Priority: unread competitor price alerts (the thing this whole page
// exists to surface) > any other unread alert (e.g. low-stock, which also
// lands in this same feed) > "nothing tracked yet" (a real onboarding gap,
// not a calm state) > calm fallback with the actual tracked count, so
// "caught up" still says something concrete rather than just "all good".
function computeWatchlistInsight(notifications: Notification[], watchlists: Watchlist[]): Insight {
  const unread = notifications.filter((n) => !n.isRead);
  const unreadPriceAlerts = unread.filter((n) => n.type === 'price_alert');

  if (unreadPriceAlerts.length > 0) {
    return {
      tone: 'warning',
      icon: MdOutlinePriceCheck,
      headline: `${unreadPriceAlerts.length} competitor price change${unreadPriceAlerts.length === 1 ? '' : 's'} to review`,
      detail: 'A tracked product just moved - see Recent alerts below.',
    };
  }

  if (unread.length > 0) {
    return {
      tone: 'warning',
      icon: MdOutlineNotificationsActive,
      headline: `${unread.length} unread alert${unread.length === 1 ? '' : 's'}`,
      detail: 'See Recent alerts below for what changed.',
    };
  }

  const trackedCount = watchlists.reduce((sum, w) => sum + w.items.length, 0);
  if (trackedCount === 0) {
    return {
      tone: 'neutral',
      icon: MdOutlineVisibility,
      headline: "You're not tracking any competitors yet",
      detail: 'Search for a product below and add it to a watchlist to get price and stock alerts.',
    };
  }

  return {
    tone: 'good',
    icon: MdOutlineCheckCircle,
    headline: 'No new alerts',
    detail: `Tracking ${trackedCount} product${trackedCount === 1 ? '' : 's'} across ${watchlists.length} watchlist${watchlists.length === 1 ? '' : 's'} - nothing has changed.`,
  };
}

// Currency comes from the seller's own reporting setting - it used to be
// hardcoded to PKR here, which mislabelled every price for a seller reporting
// in anything else.
function formatPrice(value: number | null, currency: string) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

type WatchlistViewProps = {
  categorySlug: string | null;
  reportingCurrency: string;
  watchlists: Watchlist[];
  notifications: Notification[];
};

export default function WatchlistView({
  categorySlug,
  reportingCurrency,
  watchlists: initialWatchlists,
  notifications: initialNotifications,
}: WatchlistViewProps) {
  const toast = useToast();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [watchlists, setWatchlists] = useState(initialWatchlists);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreateWatchlist() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.succeeded) {
        throw new Error(result.errors?.join(', ') || 'Failed to create watchlist');
      }
      setWatchlists((prev) => [result.data, ...prev]);
      setNewName('');
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Failed to create watchlist' });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteWatchlist(id: string) {
    const response = await fetch(`/api/watchlists/${id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.succeeded) {
      toast({ status: 'error', title: result.errors?.join(', ') || 'Failed to delete watchlist' });
      return;
    }
    setWatchlists((prev) => prev.filter((w) => w.id !== id));
  }

  function handleItemAdded(watchlistId: string, item: WatchlistItem) {
    setWatchlists((prev) =>
      prev.map((w) => (w.id === watchlistId ? { ...w, items: [item, ...w.items] } : w)),
    );
  }

  async function handleRemoveItem(watchlistId: string, itemId: string) {
    const response = await fetch(`/api/watchlists/${watchlistId}/items/${itemId}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.succeeded) {
      toast({ status: 'error', title: result.errors?.join(', ') || 'Failed to remove item' });
      return;
    }
    setWatchlists((prev) =>
      prev.map((w) => (w.id === watchlistId ? { ...w, items: w.items.filter((i) => i.id !== itemId) } : w)),
    );
  }

  async function handleMarkRead(notificationId: string) {
    await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)));
  }

  return (
    <Box>
      <PageHeader title="Watchlist" />

      {/* Computed from live state, not the initial props, so marking an
          alert read or adding a tracked product updates the headline
          without a page reload. */}
      <InsightStrip insight={computeWatchlistInsight(notifications, watchlists)} />

      <Card mb="20px">
        <Text fontSize="lg" fontWeight="600" color={textColor} mb="12px">
          Recent alerts
        </Text>
        {notifications.length === 0 ? (
          <Text fontSize="sm" color="secondaryGray.600">
            No price or stock alerts yet. Add a competitor product to a watchlist below to start
            tracking it.
          </Text>
        ) : (
          <Flex direction="column" gap="10px">
            {notifications.map((n) => (
              <Flex
                key={n.id}
                justify="space-between"
                align="center"
                p="10px"
                borderRadius="12px"
                bg={n.isRead ? 'transparent' : 'secondaryGray.100'}
              >
                <Box>
                  <Text fontSize="sm" fontWeight="600" color={textColor}>
                    {n.title}
                  </Text>
                  <Text fontSize="xs" color="secondaryGray.600">
                    {n.message}
                  </Text>
                </Box>
                {!n.isRead && (
                  <Button size="xs" variant="outline" onClick={() => handleMarkRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </Flex>
            ))}
          </Flex>
        )}
      </Card>

      <Card mb="20px">
        <Flex gap="10px" mb="16px">
          <Input
            placeholder="New watchlist name (e.g. Mobile competitors)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button variant="brand" isLoading={creating} onClick={handleCreateWatchlist} leftIcon={<MdAdd />}>
            New watchlist
          </Button>
        </Flex>

        {watchlists.length === 0 && (
          <Text fontSize="sm" color="secondaryGray.600">
            No watchlists yet. Create one to start tracking competitor products.
          </Text>
        )}
      </Card>

      {watchlists.map((watchlist) => (
        <WatchlistCard
          key={watchlist.id}
          watchlist={watchlist}
          categorySlug={categorySlug}
          reportingCurrency={reportingCurrency}
          onDelete={() => handleDeleteWatchlist(watchlist.id)}
          onItemAdded={(item) => handleItemAdded(watchlist.id, item)}
          onRemoveItem={(itemId) => handleRemoveItem(watchlist.id, itemId)}
        />
      ))}
    </Box>
  );
}

function WatchlistCard({
  watchlist,
  categorySlug,
  reportingCurrency,
  onDelete,
  onItemAdded,
  onRemoveItem,
}: {
  watchlist: Watchlist;
  categorySlug: string | null;
  reportingCurrency: string;
  onDelete: () => void;
  onItemAdded: (item: WatchlistItem) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const toast = useToast();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Distinguishes "typed too little to search yet" from "searched, found
  // nothing" - without it an empty result list is indistinguishable from the
  // initial state, which reads as a broken search.
  const [hasSearched, setHasSearched] = useState(false);

  const trimmed = query.trim();

  // Live search: debounce keystrokes so every character doesn't fire a query,
  // and abort the in-flight request when the term changes. Without the abort,
  // a slow response for "lap" can land after a fast one for "laptop" and
  // overwrite the newer results.
  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (categorySlug) params.set('categorySlug', categorySlug);
        const response = await fetch(`/api/market-products/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        setResults(result.succeeded ? result.data : []);
        setHasSearched(true);
      } catch (error) {
        // An aborted request is a superseded search, not a failure.
        if ((error as Error).name !== 'AbortError') {
          setResults([]);
          setHasSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, categorySlug]);

  async function handleAdd(productId: string) {
    const response = await fetch(`/api/watchlists/${watchlist.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketProductId: productId }),
    });
    const result = await response.json();
    if (!response.ok || !result.succeeded) {
      toast({ status: 'error', title: result.errors?.join(', ') || 'Failed to add product' });
      return;
    }
    onItemAdded(result.data);
    setResults([]);
    setQuery('');
  }

  return (
    <Card mb="20px">
      <Flex justify="space-between" align="center" mb="12px">
        <Text fontSize="lg" fontWeight="600" color={textColor}>
          {watchlist.name}
        </Text>
        <IconButton aria-label="Delete watchlist" icon={<MdDelete />} size="sm" variant="ghost" onClick={onDelete} />
      </Flex>

      <InputGroup mb="12px">
        <InputLeftElement pointerEvents="none">
          <Icon as={MdSearch} color="secondaryGray.600" />
        </InputLeftElement>
        <Input
          placeholder="Search competitor products to track..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && (
          <InputRightElement>
            <Spinner size="sm" color="secondaryGray.600" />
          </InputRightElement>
        )}
      </InputGroup>

      {results.length > 0 && (
        <Flex direction="column" gap="6px" mb="16px">
          {results.map((r) => (
            <Flex key={r.id} justify="space-between" align="center" p="8px" borderRadius="8px" bg="secondaryGray.100">
              <Text fontSize="sm">
                {r.title} {r.platformName ? `· ${r.platformName}` : ''} ·{' '}
                {formatPrice(r.price, reportingCurrency)}
              </Text>
              <Button size="xs" variant="brand" onClick={() => handleAdd(r.id)}>
                Track
              </Button>
            </Flex>
          ))}
        </Flex>
      )}

      {hasSearched && !searching && results.length === 0 && (
        <Text fontSize="sm" color="secondaryGray.600" mb="16px">
          No competitor products match “{trimmed}” in your market. Widen your{' '}
          <ChakraLink as={NextLink} href="/dashboard/market/definition" color="brand.500" fontWeight="500">
            market definition
          </ChakraLink>{' '}
          if this looks wrong.
        </Text>
      )}

      {watchlist.items.length === 0 ? (
        <Text fontSize="sm" color="secondaryGray.600">
          No products tracked yet in this watchlist.
        </Text>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Product</Th>
                <Th>Platform</Th>
                <Th>Price</Th>
                <Th>Stock</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {watchlist.items.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  </Td>
                  <Td>{item.platformName ?? '—'}</Td>
                  <Td>{formatPrice(item.price, reportingCurrency)}</Td>
                  <Td>
                    <Badge colorScheme={item.inStock ? 'green' : 'red'}>
                      {item.inStock ? 'In stock' : 'Out of stock'}
                    </Badge>
                  </Td>
                  <Td>
                    <IconButton
                      aria-label="Remove item"
                      icon={<MdDelete />}
                      size="xs"
                      variant="ghost"
                      onClick={() => onRemoveItem(item.id)}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Card>
  );
}
