'use client';

import { useState } from 'react';
import { Button, Icon, Menu, MenuButton, MenuItem, MenuList, useToast } from '@chakra-ui/react';
import { MdOutlineFileDownload } from 'react-icons/md';

type Format = 'pptx' | 'pdf';

// Both formats now come from the same ReportSnapshot (see
// lib/reports/collect-snapshot.ts, render/pptx/build-deck.ts,
// render/pdf/build-pdf.ts) - PDF is no longer paused.
export function DownloadReportButton() {
  const [isLoading, setIsLoading] = useState<Format | null>(null);
  const toast = useToast();

  const handleDownload = async (format: Format) => {
    setIsLoading(format);
    try {
      const res = await fetch(`/api/reports/generate?format=${format}`);
      if (!res.ok) {
        throw new Error('Failed to generate report');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      const fileName = match?.[1] ?? `ryvl-report.${format}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({
        title: 'Could not generate report',
        description: 'Please try again in a moment.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Menu>
      <MenuButton
        as={Button}
        variant="outline"
        size="sm"
        leftIcon={<Icon as={MdOutlineFileDownload} />}
        isLoading={isLoading !== null}
        loadingText="Preparing report..."
      >
        Download report
      </MenuButton>
      <MenuList minW="180px">
        <MenuItem onClick={() => handleDownload('pptx')}>PowerPoint (.pptx)</MenuItem>
        <MenuItem onClick={() => handleDownload('pdf')}>PDF</MenuItem>
      </MenuList>
    </Menu>
  );
}
