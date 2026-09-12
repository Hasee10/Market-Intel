// Brand mark for the Tailwind shell. Path data is the same one RyvlMark.tsx
// carries (see ASSETS.md), and the fill is Ryvl's real approved indigo
// #4318FF - not the theme's drifted #422AFB, and not TailAdmin's #465FFF.
export function RyvlWordmark({ showWord }: { showWord: boolean }) {
  return (
    <>
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="size-[26px] shrink-0">
        <rect width="32" height="32" rx="8" fill="#4318FF" />
        <path
          d="M10 22V10h6.2a3.9 3.9 0 0 1 1.2 7.6L20.6 22h-3.3l-2.8-4.2H12.7V22H10Zm2.7-6.5h3.3a1.7 1.7 0 0 0 0-3.4h-3.3v3.4Z"
          fill="#fff"
        />
      </svg>
      {showWord && (
        <span className="text-lg font-semibold -tracking-[0.02em] text-gray-900 dark:text-white">
          Ryvl
        </span>
      )}
      <span className="sr-only">Ryvl</span>
    </>
  );
}
