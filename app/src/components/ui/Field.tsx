'use client';

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

// Form primitives in TailAdmin's styling. Field supplies the label/error
// wrapper (Chakra's FormControl + FormLabel + FormErrorMessage), Input/
// Select/Textarea the controls themselves.

const control =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-950 dark:text-white';
const ok =
  'border-gray-200 focus:border-brand-300 focus:ring-brand-100 dark:border-gray-700 dark:focus:ring-gray-800';
const bad = 'border-error-400 focus:border-error-500 focus:ring-error-100 dark:border-error-500';

export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="font-outfit flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="ml-0.5 text-error-500">*</span>}
        </label>
      )}
      {children}
      {/* Error wins over hint - showing both makes the reader hunt for which
          one applies. */}
      {error ? (
        <p className="text-xs text-error-600 dark:text-error-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  invalid,
  className = '',
  ...rest
}: { invalid?: boolean; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${control} ${invalid ? bad : ok} ${className}`} />;
}

export function Textarea({
  invalid,
  className = '',
  ...rest
}: { invalid?: boolean; className?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${control} ${invalid ? bad : ok} ${className}`} />;
}

// Replaces Chakra's Switch. A real checkbox underneath, visually hidden but
// still focusable and screen-reader correct - a div-with-onClick toggle
// would lose both.
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="font-outfit flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-500 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 dark:bg-gray-700" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Select({
  invalid,
  className = '',
  children,
  ...rest
}: { invalid?: boolean; className?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${control} ${invalid ? bad : ok} ${className}`}>
      {children}
    </select>
  );
}
