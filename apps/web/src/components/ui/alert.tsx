import * as React from 'react';
import { cn } from '@/lib/utils';

/** Inline error / info message. */
function Alert({
  className,
  variant = 'error',
  ...props
}: React.ComponentProps<'div'> & { variant?: 'error' | 'info' }) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        variant === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-brand-200 bg-brand-50 text-brand-900',
        className,
      )}
      {...props}
    />
  );
}

export { Alert };
