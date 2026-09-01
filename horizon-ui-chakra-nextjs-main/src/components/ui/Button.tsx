'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Button variants matching TailAdmin's, so pages stop hand-writing the same
// class strings. `loading` renders a spinner and disables, replacing Chakra's
// isLoading.

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:hover:bg-brand-500',
  outline:
    'border border-gray-200 text-gray-700 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
  danger: 'bg-error-500 text-white hover:bg-error-600 disabled:hover:bg-error-500',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  className = '',
  disabled,
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`font-outfit inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
}

export default Button;
