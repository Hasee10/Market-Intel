// Shared by ShowcaseSection's PhoneWatchlist and HowItWorksVisual's step-3
// mockup - both need "one row saying a competitor's price moved," and a
// second hand-copied version would drift from this one the first time either
// mockup's styling changed.
export function AlertRow({ title, delta, down }: { title: string; delta: string; down: boolean }) {
  return (
    <div className="mb-1.5 flex items-center justify-between rounded-md border border-gray-100 bg-white px-1.5 py-1.5 dark:border-gray-800 dark:bg-gray-900">
      <span className="truncate pr-1 text-[7px] text-gray-700 dark:text-gray-300">{title}</span>
      <span
        className={`shrink-0 rounded px-1 text-[6.5px] font-bold ${
          down
            ? 'bg-red-50 text-red-600 dark:bg-red-500/20'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20'
        }`}
      >
        {delta}
      </span>
    </div>
  );
}

export default AlertRow;
