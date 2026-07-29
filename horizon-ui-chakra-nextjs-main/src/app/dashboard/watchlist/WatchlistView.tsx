'use client';

import { useState } from 'react';

import {
  Badge,
  Box,
  Button,
  Flex,
  Input,
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
import { MdDelete, MdAdd } from 'react-icons/md';
import Card from 'components/card/Card';

import { PageHeader } from '@/components/marketintel/PageHeader';
import type { Watchlist, WatchlistItem, ProductSearchResult } from '@/lib/market-intel/watchlists';
import type { Notification } from '@/lib/notifications/list';

function formatPrice(value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(
    value,
  );
}

type WatchlistViewProps = {
  categorySlug: string | null;
  watchlists: Watchlist[];
  notifications: Notification[];
};

export default function WatchlistView({ categorySlug, watchlists: initialWatchlists, notifications: initialNotifications }: WatchlistViewProps) {
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
  onDelete,
  onItemAdded,
  onRemoveItem,
}: {
  watchlist: Watchlist;
  categorySlug: string | null;
  onDelete: () => void;
  onItemAdded: (item: WatchlistItem) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  const toast = useToast();
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (categorySlug) params.set('categorySlug', categorySlug);
      const response = await fetch(`/api/market-products/search?${params.toString()}`);
      const result = await response.json();
      setResults(result.succeeded ? result.data : []);
    } finally {
      setSearching(false);
    }
  }

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

      <Flex gap="10px" mb="12px">
        <Input
          placeholder="Search competitor products to track..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button isLoading={searching} onClick={handleSearch}>
          Search
        </Button>
      </Flex>

      {results.length > 0 && (
        <Flex direction="column" gap="6px" mb="16px">
          {results.map((r) => (
            <Flex key={r.id} justify="space-between" align="center" p="8px" borderRadius="8px" bg="secondaryGray.100">
              <Text fontSize="sm">
                {r.title} {r.platformName ? `· ${r.platformName}` : ''} · {formatPrice(r.price)}
              </Text>
              <Button size="xs" variant="brand" onClick={() => handleAdd(r.id)}>
                Track
              </Button>
            </Flex>
          ))}
        </Flex>
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
                  <Td>{formatPrice(item.price)}</Td>
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
