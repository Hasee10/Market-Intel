'use client';

import { useState } from 'react';
import {
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Button,
  useToast,
} from '@chakra-ui/react';
import { MdOutlineFileDownload, MdOutlineSlideshow, MdPictureAsPdf } from 'react-icons/md';

type ReportFormat = 'pptx' | 'pdf';

export function DownloadReportButton() {
  const [loadingFormat, setLoadingFormat] = useState<ReportFormat | null>(null);
  const toast = useToast();

  const handleDownload = async (format: ReportFormat) => {
    setLoadingFormat(format);
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
      setLoadingFormat(null);
    }
  };

  return (
    <Menu>
      <MenuButton
        as={Button}
        variant="outline"
        size="sm"
        leftIcon={<Icon as={MdOutlineFileDownload} />}
        isLoading={loadingFormat !== null}
        loadingText="Preparing report..."
      >
        Download report
      </MenuButton>
      <MenuList minW="200px">
        <MenuItem icon={<Icon as={MdOutlineSlideshow} />} onClick={() => handleDownload('pptx')}>
          PowerPoint (.pptx)
        </MenuItem>
        <MenuItem icon={<Icon as={MdPictureAsPdf} />} onClick={() => handleDownload('pdf')}>
          PDF (.pdf)
        </MenuItem>
      </MenuList>
    </Menu>
  );
}
