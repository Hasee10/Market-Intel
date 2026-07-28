'use client';

import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
} from '@chakra-ui/react';

type ErrorAlertProps = {
  title: string;
  message?: string | null;
};

export function ErrorAlert({ title, message }: ErrorAlertProps) {
  return (
    <Alert status="error" borderRadius="16px" variant="left-accent" mt="20px">
      <AlertIcon />
      <Box>
        <AlertTitle>{title}</AlertTitle>
        {message && <AlertDescription>{message}</AlertDescription>}
      </Box>
    </Alert>
  );
}

export default ErrorAlert;
