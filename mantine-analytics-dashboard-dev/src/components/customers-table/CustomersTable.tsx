'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';

import { ActionIcon, Group, Text, TextInput, Tooltip } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconEdit, IconSearch } from '@tabler/icons-react';
import sortBy from 'lodash/sortBy';
import {
  DataTable,
  DataTableProps,
  DataTableSortStatus,
} from 'mantine-datatable';

import { ErrorAlert } from '@/components';
import type { CustomerDto } from '@/types';

const PAGE_SIZES = [5, 10, 20];

type CustomersTableProps = {
  data: CustomerDto[];
  error?: ReactNode;
  loading?: boolean;
  onEdit?: (customer: CustomerDto) => void;
};

const formatCurrency = (amount?: number) => {
  if (!amount) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const CustomersTable = ({
  data = [],
  loading,
  error,
  onEdit,
}: CustomersTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [selectedRecords, setSelectedRecords] = useState<CustomerDto[]>([]);
  const [records, setRecords] = useState<CustomerDto[]>(data.slice(0, pageSize));
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<CustomerDto>>({
    columnAccessor: 'email',
    direction: 'asc',
  });
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 200);

  const columns: DataTableProps<CustomerDto>['columns'] = useMemo(
    () => [
      {
        accessor: 'email',
        sortable: true,
        filter: (
          <TextInput
            label="Customers"
            description="Show customers whose email includes the specified text"
            placeholder="Search customers..."
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        ),
        filtering: query !== '',
        render: (item: CustomerDto) => (
          <div>
            <Text size="sm" fw={500}>
              {item.email || 'N/A'}
            </Text>
            {item.externalCustomerId && (
              <Text size="xs" c="dimmed">
                {item.externalCustomerId}
              </Text>
            )}
          </div>
        ),
      },
      {
        accessor: 'ordersCount',
        title: 'Orders',
        sortable: true,
        render: (item: CustomerDto) => item.ordersCount || 0,
      },
      {
        accessor: 'totalSpent',
        title: 'Total Spent',
        sortable: true,
        render: (item: CustomerDto) => formatCurrency(item.totalSpent),
      },
      {
        accessor: 'lastOrderAt',
        title: 'Last Order',
        sortable: true,
        render: (item: CustomerDto) =>
          item.lastOrderAt
            ? new Date(item.lastOrderAt).toLocaleDateString()
            : 'N/A',
      },
      {
        accessor: 'actions',
        title: 'Actions',
        textAlign: 'right',
        render: (item: CustomerDto) => (
          <Group gap="xs" justify="flex-end">
            {onEdit && (
              <Tooltip label="Edit">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={() => onEdit(item)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ),
      },
    ],
    [query, onEdit],
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const d = sortBy(data, sortStatus.columnAccessor) as CustomerDto[];
    const dd = d.slice(from, to) as CustomerDto[];
    let filtered = sortStatus.direction === 'desc' ? dd.reverse() : dd;

    if (debouncedQuery) {
      filtered = data
        .filter(({ email }) =>
          email?.toLowerCase().includes(debouncedQuery.trim().toLowerCase()),
        )
        .slice(from, to);
    }

    setRecords(filtered);
  }, [sortStatus, data, page, pageSize, debouncedQuery]);

  return error ? (
    <ErrorAlert title="Error loading customers" message={error.toString()} />
  ) : (
    <DataTable
      minHeight={200}
      verticalSpacing="sm"
      striped={true}
      columns={columns}
      records={records}
      selectedRecords={selectedRecords}
      onSelectedRecordsChange={setSelectedRecords}
      totalRecords={debouncedQuery ? records.length : data.length}
      recordsPerPage={pageSize}
      page={page}
      onPageChange={(p) => setPage(p)}
      recordsPerPageOptions={PAGE_SIZES}
      onRecordsPerPageChange={setPageSize}
      sortStatus={sortStatus}
      onSortStatusChange={setSortStatus}
      fetching={loading}
    />
  );
};

export default CustomersTable;
