'use client';

import { useState } from 'react';
import { Button, Icon, useToast } from '@chakra-ui/react';
import { MdOutlineFileDownload } from 'react-icons/md';

// PDF generation is paused for now (see generate-pdf.ts) until a real
// pptx->PDF conversion path is decided - only PPTX is offered here.
export function DownloadReportButton() {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reports/generate?format=pptx');
      if (!res.ok) {
        throw new Error('Failed to generate report');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      const fileName = match?.[1] ?? 'ryvl-report.pptx';

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
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      leftIcon={<Icon as={MdOutlineFileDownload} />}
      onClick={handleDownload}
      isLoading={isLoading}
      loadingText="Preparing report..."
    >
      Download report (PPTX)
    </Button>
  );
}
