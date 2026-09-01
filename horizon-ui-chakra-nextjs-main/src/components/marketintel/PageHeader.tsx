'use client';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  Heading,
  useColorModeValue,
} from '@chakra-ui/react';
import Link from 'next/link';
import { ReactNode } from 'react';

export type BreadcrumbItemDef = {
  title: string;
  href: string;
};

type PageHeaderProps = {
  title: string;
  breadcrumbItems?: BreadcrumbItemDef[];
  actionButton?: ReactNode;
};

export function PageHeader({
  title,
  breadcrumbItems,
  actionButton,
}: PageHeaderProps) {
  const textColor = useColorModeValue('secondaryGray.900', 'white');
  const linkColor = useColorModeValue('secondaryGray.600', 'secondaryGray.500');

  return (
    <Flex
      direction={{ base: 'column', md: 'row' }}
      justify="space-between"
      align={{ base: 'flex-start', md: 'center' }}
      gap="12px"
      mb="20px"
    >
      <Flex direction="column">
        {breadcrumbItems && breadcrumbItems.length > 0 && (
          <Breadcrumb fontSize="sm" mb="4px">
            {breadcrumbItems.map((item, index) => (
              <BreadcrumbItem key={index}>
                <BreadcrumbLink as={Link} href={item.href} color={linkColor}>
                  {item.title}
                </BreadcrumbLink>
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
        )}
        {/* 2026-09-01 revamp: reverted to Inter (no Merriweather). A serif
            page title read as editorial/marketing on a page whose whole
            point is to be scanned fast for numbers, not the "considered
            product" feel it was going for on the landing pages - and a
            dense, professional dashboard should read as one consistent
            typeface, not two. Sized down from `lg` (already reads large
            enough against the tightened 10px-radius/8px-radius shell
            around it) and weighted 600 instead of relying on the serif's
            own weight for presence. */}
        <Heading size="md" fontWeight="600" color={textColor}>
          {title}
        </Heading>
      </Flex>
      {actionButton && <Flex>{actionButton}</Flex>}
    </Flex>
  );
}

export default PageHeader;
