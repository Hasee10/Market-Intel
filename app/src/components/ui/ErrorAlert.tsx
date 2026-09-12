'use client';

import { MdErrorOutline } from 'react-icons/md';

type ErrorAlertProps = {
  title: string;
  message?: string | null;
};

// Left-accent error alert, used on Overview, Products, Categories, Orders,
// Customers and Settings. The accent bar is the one structural device kept
// from the Chakra version - here it encodes severity, which is exactly the
// test the dashboard's decorative section bar failed.
export function ErrorAlert({ title, message }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className="font-outfit mt-5 flex gap-3 rounded-2xl border border-error-200 border-l-4 border-l-error-500 bg-error-50 p-4 dark:border-gray-800 dark:border-l-error-500 dark:bg-gray-900"
    >
      <MdErrorOutline
        className="mt-0.5 size-5 shrink-0 text-error-600 dark:text-error-500"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-error-800 dark:text-white">{title}</p>
        {message && (
          <p className="mt-0.5 text-[13px] leading-snug text-error-700 dark:text-gray-400">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default ErrorAlert;
