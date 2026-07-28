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
        <Heading size="lg" color={textColor}>
          {title}
        </Heading>
      </Flex>
      {actionButton && <Flex>{actionButton}</Flex>}
    </Flex>
  );
}

export default PageHeader;
