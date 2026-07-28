'use client';

import { Box, Center, Flex, Heading, Text, useColorModeValue } from '@chakra-ui/react';
import { ReactNode } from 'react';

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

// Lightweight centered-card layout for the auth pages (sign in / sign up /
// password reset). Horizon's demo template ships an illustration-background
// layout, but that references image assets this app doesn't have - a plain
// centered card keeps things working without pulling in unused assets.
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  const bg = useColorModeValue('white', 'navy.800');
  const textColor = useColorModeValue('secondaryGray.900', 'white');

  return (
    <Flex minH="100vh" w="100%" align="center" justify="center" bg={useColorModeValue('gray.50', 'navy.900')}>
      <Box maxW="440px" w="100%" px="24px" py="40px">
        <Center mb="24px" flexDirection="column">
          <Heading size="lg" color={textColor} textAlign="center">
            {title}
          </Heading>
          {subtitle && (
            <Text color="secondaryGray.600" mt="8px" textAlign="center">
              {subtitle}
            </Text>
          )}
        </Center>
        <Box bg={bg} borderRadius="20px" boxShadow="0px 18px 40px rgba(112, 144, 176, 0.12)" p="32px">
          {children}
        </Box>
      </Box>
    </Flex>
  );
}

export default AuthCard;
