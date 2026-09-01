import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";
const Card = {
  baseStyle: (props: StyleFunctionProps) => ({
    p: "20px",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    position: "relative",
    // 2026-09-01 revamp: 20px -> 10px radius, and a real 1px structural
    // border added at the theme level (the stock template had neither a
    // base border nor a base shadow here - pages that wanted a defined
    // card edge had to hand-roll their own boxShadow locally, e.g.
    // Overview/Market's repeated `cardShadow` variable). A thin border is
    // the "structured enterprise" language (Ant Design Pro/Salesforce
    // Lightning both use borders over ambient shadows for card definition)
    // and, unlike a shadow, costs nothing extra to render consistently.
    borderRadius: "10px",
    border: "1px solid",
    borderColor: mode("secondaryGray.200", "whiteAlpha.100")(props),
    minWidth: "0px",
    wordWrap: "break-word",
    bg: mode("#ffffff", "navy.800")(props),
    backgroundClip: "border-box",
  }),
};

export const CardComponent = {
  components: {
    Card,
  },
};
