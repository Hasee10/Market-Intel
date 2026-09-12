'use client';

// THROWAWAY SPIKE PAGE - delete before the migration proper begins.
//
// Purpose: prove Tailwind 4 and Chakra 2 can share one page in THIS codebase
// before committing to a page-by-page migration that assumes they can.
//
// What to look for when checking this in a browser:
//  1. The Chakra column must look exactly like Chakra does everywhere else -
//     rounded buttons, correct input chrome, normal heading sizes. If
//     Tailwind's preflight had leaked in, headings would collapse to body
//     size and buttons would lose their styling.
//  2. The Tailwind column must actually be styled - if utilities weren't
//     compiling, it would render as unstyled stacked text.
//  3. The two swatches at the bottom must be the SAME indigo. Left is
//     Chakra's brand.500 token, right is Tailwind's brand-500. Both should
//     be Ryvl's #4318FF once the theme token is reconciled - today the
//     Chakra one is still the drifted #422AFB, which is exactly the kind of
//     mismatch this page is here to make visible rather than assumed.

import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], display: 'swap' });

export default function TailwindSpikePage() {
  return (
    <Box minH="100vh" bg="gray.50" py="10" px="6">
      <Box maxW="1200px" mx="auto">
        <Heading size="lg" mb="1">
          Tailwind / Chakra coexistence spike
        </Heading>
        <Text color="gray.600" mb="8">
          Left column is Chakra. Right column is Tailwind. Both are on this page
          at the same time.
        </Text>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ---------------- Chakra side ---------------- */}
          <Card borderRadius="16px" borderWidth="1px" borderColor="gray.200">
            <CardBody>
              <Badge colorScheme="purple" mb="4">
                Chakra UI
              </Badge>
              <Heading size="md" mb="2">
                Existing components, untouched
              </Heading>
              <Text color="gray.600" fontSize="sm" mb="5">
                If Tailwind&apos;s reset had loaded, this heading would be body-sized
                and the button below would be unstyled.
              </Text>

              <Stack spacing="3">
                <Input placeholder="A Chakra input" />
                <Button colorScheme="brand">A Chakra button</Button>
                <Button variant="outline">Outline variant</Button>
              </Stack>
            </CardBody>
          </Card>

          {/* ---------------- Tailwind side ---------------- */}
          <div
            className={`${outfit.className} rounded-2xl border border-gray-200 bg-white p-6`}
          >
            <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              Tailwind 4
            </span>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
              TailAdmin styling, real tokens
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              This card is plain markup with utility classes only &mdash; no Chakra
              involved. Font is Outfit, radii and borders are TailAdmin&apos;s.
            </p>

            {/* A real TailAdmin stat card, rebuilt from their EcommerceMetrics */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                  <svg
                    className="h-6 w-6 text-gray-800"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path d="M12 2.5v19" />
                    <path d="M16.5 6.8c-.6-1.4-2.3-2.3-4.5-2.3-2.7 0-4.5 1.3-4.5 3.2 0 4.6 9 2.4 9 7.1 0 2-2 3.3-4.7 3.3-2.4 0-4.2-1-4.8-2.5" />
                  </svg>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <span className="text-sm text-gray-500">Revenue (30d)</span>
                    <h4 className="mt-2 text-title-sm font-bold text-gray-800">
                      PKR 3.42M
                    </h4>
                  </div>
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700">
                    +12.4%
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                  <svg
                    className="h-6 w-6 text-gray-800"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path d="M5.5 7h13l-1.2 12.5H6.7L5.5 7Z" />
                    <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
                  </svg>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <span className="text-sm text-gray-500">Orders</span>
                    <h4 className="mt-2 text-title-sm font-bold text-gray-800">
                      1,284
                    </h4>
                  </div>
                  <span className="rounded-full bg-error-50 px-2 py-0.5 text-xs font-semibold text-error-700">
                    &minus;3.2%
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              A Tailwind button
            </button>
          </div>
        </div>

        {/* ---------------- brand-token comparison ---------------- */}
        <Box mt="10">
          <Heading size="sm" mb="3">
            Brand token comparison
          </Heading>
          <Text color="gray.600" fontSize="sm" mb="4">
            These should end up identical. Any visible difference is the colour
            drift documented in ASSETS.md, not a bug in this spike.
          </Text>
          <div className="flex flex-wrap gap-4">
            <Box
              bg="brand.500"
              color="white"
              px="5"
              py="4"
              borderRadius="10px"
              fontSize="sm"
              fontWeight="600"
            >
              Chakra brand.500
            </Box>
            <div className="rounded-[10px] bg-brand-500 px-5 py-4 text-sm font-semibold text-white">
              Tailwind brand-500 (#4318FF)
            </div>
          </div>
        </Box>
      </Box>
    </Box>
  );
}
