'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MdAddCircleOutline, MdGridView, MdOutlineSearchOff, MdUploadFile, MdViewList } from 'react-icons/md';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Pagination, usePagination } from '@/components/ui/Pagination';

import { BulkImportDrawer, ImportField } from '@/components/marketintel/BulkImportDrawer';
import { CustomersTable } from '@/components/marketintel/CustomersTable';
import { PageHeader } from '@/components/marketintel/PageHeader';
import { RetentionPanel } from '@/components/marketintel/RetentionPanel';
import { PATH_DASHBOARD } from '@/lib/paths';
import type { CustomerDto } from '@/types/customer';
import type { AtRiskCustomer, ChurnSnapshot } from '@/lib/market-intel/seller/rfm';

import { CustomerCard } from './components/CustomerCard';
import { EditCustomerDrawer } from './components/EditCustomerDrawer';
import { NewCustomerDrawer } from './components/NewCustomerDrawer';

// Pure rendering - customers AND the retention panel's data both arrive as
// props from page.tsx's single server fetch. This page used to run TWO
// independent client fetches: useCustomers() for the main list, and a
// second one inside <RetentionPanel /> for /api/customers/at-risk - two
// separate auth round trips (see overview.ts's header comment) to render
// one page. RetentionPanel itself is now a pure prop-driven component; see
// its own file for that change.
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

type CustomersViewProps = {
  customers: CustomerDto[];
  retentionSnapshot: ChurnSnapshot | null;
  atRiskCustomers: AtRiskCustomer[];
  reportingCurrency: string;
};

export default function CustomersView({
  customers,
  retentionSnapshot,
  atRiskCustomers,
  reportingCurrency,
}: CustomersViewProps) {
  const router = useRouter();

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [newOpen, setNewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // /api/customers has no limit either - both views below rendered the
  // seller's whole customer list in one grid or one table. Same fix and
  // same page size as Products, so switching grid/table keeps your place.
  const customerPage = usePagination(customers, 12);

  // No refetch() on a Server Component - router.refresh() re-runs page.tsx
  // and hands this component fresh props, same substitution made on
  // Products (see ProductsView.tsx's header comment).
  const refreshCustomers = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleEditCustomer = (customer: CustomerDto) => {
    setSelectedCustomer(customer);
    setEditOpen(true);
  };

  const renderContent = () => {
    if (!customers.length) {
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

    // Can't share one Pagination placed after both branches: the table
    // view has a Card wrapper with its own horizontal padding and the grid
    // view doesn't (the cards themselves are the grid items), so a control
    // sitting outside both inherits neither's padding and visibly hugs the
    // bare page edge under the table instead of lining up with it - the same
    // "pagination is at the very side" bug fixed on Products. Nested inside
    // whichever container that view actually has.
    const pagination = (
      <Pagination
        page={customerPage.page}
        pageCount={customerPage.pageCount}
        onPageChange={customerPage.setPage}
        rangeStart={customerPage.rangeStart}
        rangeEnd={customerPage.rangeEnd}
        total={customerPage.total}
        label="customers"
      />
    );

    return viewMode === 'grid' ? (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {customerPage.visible.map((customer) => (
            <CustomerCard key={customer.id} data={customer} onEdit={handleEditCustomer} />
          ))}
        </div>
        {pagination}
      </>
    ) : (
      <Card>
        {/* Table brings its own overflow-x container, so no wrapper needed. */}
        <CustomersTable data={customerPage.visible} loading={false} onEdit={handleEditCustomer} />
        {pagination}
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
            {customers.length > 0 && (
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

      <RetentionPanel
        snapshot={retentionSnapshot}
        atRiskCustomers={atRiskCustomers}
        reportingCurrency={reportingCurrency}
      />

      {renderContent()}

      <NewCustomerDrawer isOpen={newOpen} onClose={() => setNewOpen(false)} onCustomerCreated={refreshCustomers} />

      <EditCustomerDrawer
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        customer={selectedCustomer}
        onCustomerUpdated={refreshCustomers}
      />

      <BulkImportDrawer
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="customers"
        fields={IMPORT_FIELDS}
        apiEndpoint="/api/customers/bulk-import"
        onImported={refreshCustomers}
      />
    </>
  );
}
