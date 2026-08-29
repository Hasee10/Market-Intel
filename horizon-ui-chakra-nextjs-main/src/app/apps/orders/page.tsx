'use client';

import { useCallback, useState } from 'react';

import { Button, Flex, Icon, Stack, Text } from '@chakra-ui/react';
import {
  MdAddCircleOutline,
  MdOutlineSearchOff,
  MdUploadFile,
  MdOutlinePendingActions,
  MdOutlineCheckCircle,
} from 'react-icons/md';

import Card from 'components/card/Card';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import { OrdersTable } from '@/components/marketintel/OrdersTable';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { useFetch } from '@/lib/hooks/useApi';
import { PATH_DASHBOARD } from '@/lib/paths';
import { IApiResponse } from '@/types/api-response';
import { OrderDto } from '@/types/order';

import { EditOrderDrawer } from './components/EditOrderDrawer';
import { NewOrderDrawer } from './components/NewOrderDrawer';

const breadcrumbItems = [
  { title: 'Dashboard', href: PATH_DASHBOARD.default },
  { title: 'Orders', href: '#' },
];

// Same instant-insight pattern used across the app (InsightStrip.tsx).
// Deliberately narrow to fulfillment status - not revenue, which is
// already Overview's headline - since that's the one thing unique to
// looking at the raw order list rather than a trend chart: which orders
// still need your attention. Priority: pending orders (the actionable
// state - update status once fulfilled/shipped) > calm fallback stating
// the real resolved count.
function computeOrdersInsight(orders: OrderDto[]): Insight {
  const pending = orders.filter((o) => o.status === 'pending');
  if (pending.length > 0) {
    return {
      tone: 'warning',
      icon: MdOutlinePendingActions,
      headline: `${pending.length} order${pending.length === 1 ? '' : 's'} still pending`,
      detail: 'Update their status once fulfilled, shipped, or cancelled.',
    };
  }

  return {
    tone: 'good',
    icon: MdOutlineCheckCircle,
    headline: `${orders.length} order${orders.length === 1 ? '' : 's'} on record, none pending`,
    detail: 'Every order is completed, cancelled, or refunded.',
  };
}

const IMPORT_FIELDS: ImportField[] = [
  { key: 'externalOrderId', label: 'Order ID', required: true },
  { key: 'orderDate', label: 'Order date (YYYY-MM-DD)', required: true },
  { key: 'totalAmount', label: 'Total amount', required: true, type: 'number' },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
  { key: 'customerExternalId', label: 'Customer ID (from your store)' },
];

export default function OrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const {
    data: ordersData,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useFetch<IApiResponse<OrderDto[]>>('/api/orders');

  const handleOrderChanged = useCallback(() => {
    refetchOrders();
  }, [refetchOrders]);

  const handleEditOrder = (order: OrderDto) => {
    setSelectedOrder(order);
    setEditOpen(true);
  };

  const renderContent = () => {
    if (ordersError || (ordersData && !ordersData.succeeded)) {
      return (
        <ErrorAlert
          title="Error loading orders"
          message={ordersData?.errors?.join(', ') || ordersError?.message}
        />
      );
    }

    if (!ordersLoading && !ordersData?.data?.length) {
      return (
        <Card>
          <Stack align="center" spacing="8px" py="24px">
            <Icon as={MdOutlineSearchOff} boxSize="28px" color="secondaryGray.600" />
            <Text fontSize="lg" fontWeight="700">
              No orders found
            </Text>
            <Text color="secondaryGray.600">You don&apos;t have any orders yet. Add one to get started.</Text>
            <Button variant="brand" leftIcon={<Icon as={MdAddCircleOutline} />} onClick={() => setNewOpen(true)}>
              New Order
            </Button>
          </Stack>
        </Card>
      );
    }

    return (
      <Card>
        <OrdersTable data={ordersData?.data ?? []} loading={ordersLoading} onEdit={handleEditOrder} />
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Orders"
        breadcrumbItems={breadcrumbItems}
        actionButton={
          <Flex gap="8px">
            <Button variant="outline" leftIcon={<Icon as={MdUploadFile} />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button variant="brand" leftIcon={<Icon as={MdAddCircleOutline} />} onClick={() => setNewOpen(true)}>
              New Order
            </Button>
          </Flex>
        }
      />

      {!ordersLoading && ordersData?.succeeded && ordersData.data && ordersData.data.length > 0 && (
        <InsightStrip insight={computeOrdersInsight(ordersData.data)} />
      )}

      {renderContent()}

      <NewOrderDrawer isOpen={newOpen} onClose={() => setNewOpen(false)} onOrderCreated={handleOrderChanged} />

      <EditOrderDrawer
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        order={selectedOrder}
        onOrderUpdated={handleOrderChanged}
      />

      <BulkImportDrawer
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="orders"
        fields={IMPORT_FIELDS}
        apiEndpoint="/api/orders/bulk-import"
        onImported={handleOrderChanged}
      />
    </>
  );
}
