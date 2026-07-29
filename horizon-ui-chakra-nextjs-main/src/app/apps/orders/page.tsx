'use client';

import { useCallback, useState } from 'react';

import { Button, Flex, Icon, Stack, Text } from '@chakra-ui/react';
import { MdAddCircleOutline, MdOutlineSearchOff, MdUploadFile } from 'react-icons/md';

import Card from 'components/card/Card';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
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
