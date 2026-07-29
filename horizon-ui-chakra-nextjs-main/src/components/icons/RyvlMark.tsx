type RyvlMarkProps = {
  size?: number | string;
  color?: string;
};

// The Ryvl brand mark - two overlapping right-facing chevrons, the second
// with a vertical foot reading as an "R". Hand-built to closely match the
// approved logo (see chat history), not traced pixel-for-pixel from the
// source image - if an exported SVG from that image ever becomes available,
// swap the <path> data below for it directly.
export function RyvlMark({ size = 32, color = '#4318FF' }: RyvlMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 14 L38 14 L64 44 L38 74 L38 60 L20 74 L8 74 L8 14 Z"
        fill={color}
      />
      <path
        d="M38 14 L60 14 L92 44 L60 74 L38 74 L64 44 Z"
        fill={color}
      />
    </svg>
  );
}

export default RyvlMark;
