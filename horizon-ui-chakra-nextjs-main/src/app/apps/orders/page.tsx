'use client';

import { useCallback, useState } from 'react';

import {
  MdAddCircleOutline,
  MdOutlineSearchOff,
  MdUploadFile,
  MdOutlineDownload,
  MdOutlinePendingActions,
  MdOutlineCheckCircle,
} from 'react-icons/md';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination, usePagination } from '@/components/ui/Pagination';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { InsightStrip, type Insight } from '@/components/marketintel/InsightStrip';
import { OrdersTable } from '@/components/marketintel/OrdersTable';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { useFetch } from '@/lib/hooks/useApi';
import { objectsToCsv, triggerCsvDownload } from '@/lib/csv';
import { PATH_DASHBOARD } from '@/lib/paths';
import { IApiResponse } from '@/types/api-response';
import { OrderDto } from '@/types/order';

const dateStamp = () => new Date().toISOString().slice(0, 10);

// Exports every order currently loaded on the page (all of them - Orders
// has no server-side filter today, only the client-side pager), not just
// the visible page. Full id alongside the short display id: the table
// truncates to 8 characters for screen width, which is fine to read but
// lossy to export - a seller reconciling against another system needs the
// real value, not the abbreviation.
function exportOrdersCsv(orders: OrderDto[]) {
  const csv = objectsToCsv(
    orders.map((o) => ({
      id: o.id,
      externalOrderId: o.externalOrderId ?? '',
      customer: o.customerLabel ?? 'Guest',
      date: o.orderDate.slice(0, 10),
      amount: o.totalAmount,
      currency: o.currency,
      status: o.status ?? '',
    })),
    [
      { key: 'id', label: 'Order ID' },
      { key: 'externalOrderId', label: 'External order ID' },
      { key: 'customer', label: 'Customer' },
      { key: 'date', label: 'Order date' },
      { key: 'amount', label: 'Amount' },
      { key: 'currency', label: 'Currency' },
      { key: 'status', label: 'Status' },
    ],
  );
  triggerCsvDownload(csv, `orders-${dateStamp()}.csv`);
}

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

  // /api/orders has no limit and returns the seller's whole order history in
  // one response - this was rendering all of it in one unbroken table, the
  // same defect Products had before it was paginated.
  const orders = ordersData?.data ?? [];
  const orderPage = usePagination(orders, 12);

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

    if (!ordersLoading && !orders.length) {
      return (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <MdOutlineSearchOff className="size-7 text-gray-400" aria-hidden="true" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">No orders found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You don&apos;t have any orders yet. Add one to get started.
            </p>
            <Button
              className="mt-2"
              leftIcon={<MdAddCircleOutline className="size-4" />}
              onClick={() => setNewOpen(true)}
            >
              New Order
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <Card>
        <OrdersTable data={orderPage.visible} loading={ordersLoading} onEdit={handleEditOrder} />
        <Pagination
          page={orderPage.page}
          pageCount={orderPage.pageCount}
          onPageChange={orderPage.setPage}
          rangeStart={orderPage.rangeStart}
          rangeEnd={orderPage.rangeEnd}
          total={orderPage.total}
          label="orders"
        />
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Orders"
        breadcrumbItems={breadcrumbItems}
        actionButton={
          <div className="flex gap-2">
            {orders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<MdOutlineDownload className="size-4" />}
                onClick={() => exportOrdersCsv(orders)}
              >
                Export CSV
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<MdUploadFile className="size-4" />}
              onClick={() => setImportOpen(true)}
            >
              Import CSV
            </Button>
            <Button
              size="sm"
              leftIcon={<MdAddCircleOutline className="size-4" />}
              onClick={() => setNewOpen(true)}
            >
              New Order
            </Button>
          </div>
        }
      />

      {!ordersLoading && ordersData?.succeeded && orders.length > 0 && (
        <InsightStrip insight={computeOrdersInsight(orders)} />
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
