import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Native <select> styled to match the design system. Native is intentional:
 * it is accessible by default, keyboard-friendly, and works without client JS.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'flex h-11 w-full appearance-none rounded-md border border-border-strong bg-surface px-3 pr-9 py-2 text-base text-ink',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-[invalid=true]:border-danger',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
      </div>
    )
  }
)
Select.displayName = 'Select'
