'use client';

import { useCallback, useState } from 'react';

import { MdAddCircleOutline, MdGridView, MdOutlineSearchOff, MdUploadFile, MdViewList } from 'react-icons/md';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { CustomersTable } from '@/components/marketintel/CustomersTable';
import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { RetentionPanel } from '@/components/marketintel/RetentionPanel';
import { useCustomers } from '@/lib/hooks/useApi';
import { PATH_DASHBOARD } from '@/lib/paths';
import type { CustomerDto } from '@/types/customer';

import { CustomerCard } from './components/CustomerCard';
import { EditCustomerDrawer } from './components/EditCustomerDrawer';
import { NewCustomerDrawer } from './components/NewCustomerDrawer';

type ViewMode = 'grid' | 'table';

const breadcrumbItems = [
  { title: 'Dashboard', href: PATH_DASHBOARD.default },
  { title: 'Customers', href: '#' },
];

const IMPORT_FIELDS: ImportField[] = [
  { key: 'externalCustomerId', label: 'Customer ID', required: true },
  { key: 'email', label: 'Email' },
  { key: 'ordersCount', label: 'Orders count', type: 'number' },
  { key: 'totalSpent', label: 'Total spent', type: 'number' },
  { key: 'currency', label: 'Currency (e.g. PKR)' },
];

export default function CustomersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const {
    data: customersData,
    loading: customersLoading,
    error: customersError,
    refetch: refetchCustomers,
  } = useCustomers();

  const handleCustomerCreated = useCallback(() => {
    refetchCustomers();
  }, [refetchCustomers]);

  const handleCustomerUpdated = useCallback(() => {
    refetchCustomers();
  }, [refetchCustomers]);

  const handleEditCustomer = (customer: CustomerDto) => {
    setSelectedCustomer(customer);
    setEditOpen(true);
  };

  const renderContent = () => {
    if (customersLoading) {
      return viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`customer-loading-${i}`}
              className="h-[180px] animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      ) : (
        <Card>
          <CustomersTable data={[]} loading onEdit={handleEditCustomer} />
        </Card>
      );
    }

    if (customersError || (customersData && !customersData.succeeded)) {
      return (
        <ErrorAlert
          title="Error loading customers"
          message={
            customersData?.errors?.join(', ') || customersError?.message || 'Failed to load customers'
          }
        />
      );
    }

    if (!customersData?.data?.length) {
      return (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <MdOutlineSearchOff className="size-7 text-gray-400" aria-hidden="true" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">No customers found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You don&apos;t have any customers yet. Create one to get started.
            </p>
            <Button
              className="mt-2"
              leftIcon={<MdAddCircleOutline className="size-4" />}
              onClick={() => setNewOpen(true)}
            >
              New Customer
            </Button>
          </div>
        </Card>
      );
    }

    return viewMode === 'grid' ? (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {(customersData.data as CustomerDto[]).map((customer) => (
          <CustomerCard key={customer.id} data={customer} onEdit={handleEditCustomer} />
        ))}
      </div>
    ) : (
      <Card>
        {/* Table brings its own overflow-x container, so no wrapper needed. */}
        <CustomersTable
          data={customersData.data as CustomerDto[]}
          loading={false}
          onEdit={handleEditCustomer}
        />
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Customers"
        breadcrumbItems={breadcrumbItems}
        actionButton={
          <div className="flex flex-wrap gap-2">
            {customersData?.data && customersData.data.length > 0 && (
              // Segmented grid/table switch, matching the same control on
              // Products rather than two loose buttons.
              <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={viewMode === 'grid'}
                  onClick={() => setViewMode('grid')}
                  className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <MdGridView className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Table view"
                  aria-pressed={viewMode === 'table'}
                  onClick={() => setViewMode('table')}
                  className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <MdViewList className="size-4" />
                </button>
              </div>
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
              New Customer
            </Button>
          </div>
        }
      />

      <RetentionPanel />

      {renderContent()}

      <NewCustomerDrawer
        isOpen={newOpen}
        onClose={() => setNewOpen(false)}
        onCustomerCreated={handleCustomerCreated}
      />

      <EditCustomerDrawer
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        customer={selectedCustomer}
        onCustomerUpdated={handleCustomerUpdated}
      />

      <BulkImportDrawer
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="customers"
        fields={IMPORT_FIELDS}
        apiEndpoint="/api/customers/bulk-import"
        onImported={handleCustomerCreated}
      />
    </>
  );
}
