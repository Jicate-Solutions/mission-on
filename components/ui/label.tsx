import * as React from 'react'

import { cn } from '@/lib/utils'

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'mb-1.5 block text-sm font-medium text-ink',
          'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
    )
  }
)
Label.displayName = 'Label'
