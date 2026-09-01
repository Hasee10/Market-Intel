import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

const bodyFont = "var(--font-inter), sans-serif";

// Enterprise-dashboard palette (2026-09-01 revamp) - replaces the stock
// Horizon UI template's purple/lavender defaults (brand #422AFB,
// secondaryGray tinted toward blue-violet, navy literally navy-blue) with a
// neutral slate scale + a restrained professional blue accent. Every token
// KEY below is unchanged on purpose - hundreds of components across the app
// reference `secondaryGray.600`, `navy.800`, `brand.500` etc. directly:
// changing what these keys mean (their hex values) propagates the new
// palette everywhere automatically; renaming the keys themselves would mean
// touching every one of those call sites instead, which is out of scope for
// a foundation-only pass. Only lib/reports/** (PDF/PPTX export) is exempt -
// it has its own separate design-tokens.ts and was explicitly told not to
// change.
export const globalStyles = {
  fonts: {
    heading: bodyFont,
    body: bodyFont,
  },
  colors: {
    brand: {
      100: "#DBEAFE",
      200: "#93C5FD",
      300: "#60A5FA",
      400: "#3B82F6",
      500: "#2563EB",
      600: "#1D4ED8",
      700: "#1E40AF",
      800: "#1E3A8A",
      900: "#172554",
    },
    brandScheme: {
      100: "#DBEAFE",
      200: "#60A5FA",
      300: "#60A5FA",
      400: "#3B82F6",
      500: "#2563EB",
      600: "#1D4ED8",
      700: "#1E40AF",
      800: "#1E3A8A",
      900: "#1E40AF",
    },
    brandTabs: {
      100: "#DBEAFE",
      200: "#2563EB",
      300: "#2563EB",
      400: "#2563EB",
      500: "#2563EB",
      600: "#1D4ED8",
      700: "#1E40AF",
      800: "#1E3A8A",
      900: "#1E40AF",
    },
    secondaryGray: {
      100: "#F1F5F9",
      200: "#E2E8F0",
      300: "#F8FAFC",
      400: "#E5E9F0",
      500: "#64748B",
      600: "#475569",
      700: "#334155",
      800: "#334155",
      900: "#0F172A",
    },
    red: {
      100: "#FEE2E2",
      500: "#DC2626",
      600: "#B91C1C",
    },
    blue: {
      50: "#EFF6FF",
      500: "#2563EB",
    },
    orange: {
      100: "#FEF3C7",
      500: "#D97706",
    },
    green: {
      100: "#DCFCE7",
      500: "#16A34A",
    },
    navy: {
      50: "#F1F5F9",
      100: "#E2E8F0",
      200: "#CBD5E1",
      300: "#94A3B8",
      400: "#64748B",
      500: "#475569",
      600: "#334155",
      700: "#1E293B",
      800: "#1E293B",
      900: "#0F172A",
    },
    gray: {
      100: "#F8FAFC",
    },
  },
  styles: {
    global: (props: StyleFunctionProps) => ({
      body: {
        overflowX: "hidden",
        bg: mode("secondaryGray.300", "navy.900")(props),
        fontFamily: bodyFont,
      },
      input: {
        color: "gray.700",
      },
      html: {
        fontFamily: bodyFont,
      },
    }),
  },
};
