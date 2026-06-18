import * as React from 'react'

import { cn } from '@/lib/utils'

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'flex w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-ink',
          'placeholder:text-ink-muted',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-danger',
          'resize-y',
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
