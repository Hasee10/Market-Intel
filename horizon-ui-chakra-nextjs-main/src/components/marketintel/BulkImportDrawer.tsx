'use client';

import { useState } from 'react';

import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  FormControl,
  FormLabel,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';

import { csvToObjects } from '@/lib/csv';

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'number' | 'boolean' | 'string';
};

type BulkImportDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fields: ImportField[];
  apiEndpoint: string;
  onImported?: () => void;
};

const PREVIEW_ROWS = 5;

function coerce(value: string, type: ImportField['type']) {
  if (value === undefined || value === '') return type === 'number' ? undefined : value;
  if (type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === 'boolean') return /^(1|true|yes)$/i.test(value.trim());
  return value;
}

export function BulkImportDrawer({ isOpen, onClose, title, fields, apiEndpoint, onImported }: BulkImportDrawerProps) {
  const toast = useToast();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const reset = () => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = csvToObjects(text);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setResult(null);

    // Best-effort auto-map by exact/loose header name match.
    const autoMapping: Record<string, string> = {};
    for (const field of fields) {
      const match = parsed.headers.find(
        (h) => h.toLowerCase().replace(/[\s_-]/g, '') === field.key.toLowerCase().replace(/[\s_-]/g, ''),
      );
      if (match) autoMapping[field.key] = match;
    }
    setMapping(autoMapping);
  };

  const missingRequired = fields.filter((f) => f.required && !mapping[f.key]);

  const handleImport = async () => {
    if (missingRequired.length > 0) {
      toast({ status: 'error', title: `Map required field(s): ${missingRequired.map((f) => f.label).join(', ')}` });
      return;
    }

    setImporting(true);
    try {
      const objectRows = rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const field of fields) {
          const headerName = mapping[field.key];
          if (!headerName) continue;
          const colIndex = headers.indexOf(headerName);
          if (colIndex === -1) continue;
          obj[field.key] = coerce(row[colIndex] ?? '', field.type);
        }
        return obj;
      });

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: objectRows }),
      });
      const data = await response.json();

      if (!response.ok || !data.succeeded) {
        throw new Error(data.errors?.join(', ') || data.message || 'Import failed');
      }

      setResult(data.data);
      toast({ status: 'success', title: `Imported ${data.data.imported} row(s)` });
      onImported?.();
    } catch (error) {
      toast({ status: 'error', title: error instanceof Error ? error.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      size="lg"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Bulk import {title}</DrawerHeader>
        <DrawerBody>
          <Stack spacing="16px">
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="500">
                CSV file
              </FormLabel>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </FormControl>

            {headers.length > 0 && (
              <>
                <Text fontSize="sm" fontWeight="600">
                  Map columns
                </Text>
                <Stack spacing="8px">
                  {fields.map((field) => (
                    <FormControl key={field.key}>
                      <FormLabel fontSize="xs" mb="2px">
                        {field.label}
                        {field.required && ' *'}
                      </FormLabel>
                      <Select
                        size="sm"
                        placeholder="Not mapped"
                        value={mapping[field.key] ?? ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      >
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                  ))}
                </Stack>

                <Text fontSize="sm" fontWeight="600">
                  Preview ({rows.length} row{rows.length === 1 ? '' : 's'} total)
                </Text>
                <Box overflowX="auto">
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        {headers.map((h) => (
                          <Th key={h}>{h}</Th>
                        ))}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                        <Tr key={i}>
                          {row.map((cell, j) => (
                            <Td key={j}>{cell}</Td>
                          ))}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </>
            )}

            {result && (
              <Alert status="success" borderRadius="12px">
                <AlertIcon />
                Imported {result.imported} row(s){result.skipped > 0 && `, skipped ${result.skipped} invalid row(s)`}
              </Alert>
            )}
          </Stack>
        </DrawerBody>
        <DrawerFooter>
          <Button
            variant="brand"
            w="100%"
            onClick={handleImport}
            isLoading={importing}
            isDisabled={rows.length === 0}
          >
            Import {rows.length > 0 ? `${rows.length} row(s)` : ''}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default BulkImportDrawer;
