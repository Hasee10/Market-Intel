type RyvlMarkProps = {
  size?: number | string;
  color?: string;
};

// The real Ryvl brand mark, exactly as approved (see ryvl-icon.svg /
// ryvl-logo-horizontal.svg at the repo root) - two overlapping right-facing
// chevrons, the second with a foot reading as an "R".
export function RyvlMark({ size = 32, color = '#4318FF' }: RyvlMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke={color} strokeWidth="34" strokeLinecap="square" strokeLinejoin="round">
        <path d="M35 38 L103 106 L35 174" />
        <path d="M113 38 L181 106 L131 156 L185 210" />
      </g>
    </svg>
  );
}

export default RyvlMark;
