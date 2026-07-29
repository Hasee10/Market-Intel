'use client';

import { useCallback, useState } from 'react';

import { Box, Button, Flex, Icon, SimpleGrid, Skeleton, Stack, Text } from '@chakra-ui/react';
import { MdAddCircleOutline, MdGridView, MdOutlineSearchOff, MdUploadFile, MdViewList } from 'react-icons/md';

import Card from 'components/card/Card';

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
];

export default function CustomersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
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
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`customer-loading-${i}`} height="180px" borderRadius="16px" />
          ))}
        </SimpleGrid>
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
          <Stack align="center" spacing="8px" py="24px">
            <Icon as={MdOutlineSearchOff} boxSize="28px" color="secondaryGray.600" />
            <Text fontSize="lg" fontWeight="700">
              No customers found
            </Text>
            <Text color="secondaryGray.600">
              You don&apos;t have any customers yet. Create one to get started.
            </Text>
            <Button
              variant="brand"
              leftIcon={<Icon as={MdAddCircleOutline} />}
              onClick={() => setNewOpen(true)}
            >
              New Customer
            </Button>
          </Stack>
        </Card>
      );
    }

    return viewMode === 'grid' ? (
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="20px">
        {(customersData.data as CustomerDto[]).map((customer) => (
          <CustomerCard key={customer.id} data={customer} onEdit={handleEditCustomer} />
        ))}
      </SimpleGrid>
    ) : (
      <Card>
        <Box overflowX="auto">
          <CustomersTable
            data={customersData.data as CustomerDto[]}
            loading={false}
            onEdit={handleEditCustomer}
          />
        </Box>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Customers"
        breadcrumbItems={breadcrumbItems}
        actionButton={
          <Flex gap="8px">
            {customersData?.data && customersData.data.length > 0 && (
              <>
                <Button
                  variant={viewMode === 'grid' ? 'brand' : 'outline'}
                  onClick={() => setViewMode('grid')}
                  p="0"
                  w="40px"
                >
                  <Icon as={MdGridView} />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'brand' : 'outline'}
                  onClick={() => setViewMode('table')}
                  p="0"
                  w="40px"
                >
                  <Icon as={MdViewList} />
                </Button>
              </>
            )}
            <Button variant="outline" leftIcon={<Icon as={MdUploadFile} />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button
              variant="brand"
              leftIcon={<Icon as={MdAddCircleOutline} />}
              onClick={() => setNewOpen(true)}
            >
              New Customer
            </Button>
          </Flex>
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
