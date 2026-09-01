'use client';
import React, { ReactNode } from 'react';
// Tailwind (theme + utilities, no preflight - see the file's own header for
// why the reset is deliberately excluded). Loaded first so Chakra/Emotion's
// runtime-injected, unlayered styles still take precedence on any element
// that ends up carrying both during the migration.
import 'styles/tailwind.css';
import 'styles/App.css';
import 'styles/Contact.css';
import 'styles/MiniCalendar.css';
import { ChakraProvider } from '@chakra-ui/react';
import theme from '../theme/theme';

export default function AppWrappers({ children }: { children: ReactNode }) {
  return <ChakraProvider theme={theme}>{children}</ChakraProvider>;
}
