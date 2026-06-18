import * as React from 'react'

import { cn } from '@/lib/utils'

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'link'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-brand-700 active:bg-brand-800',
  secondary:
    'bg-surface-muted text-ink hover:bg-border active:bg-border-strong',
  outline:
    'border border-border-strong bg-surface text-ink hover:bg-surface-muted',
  ghost: 'bg-transparent text-ink hover:bg-surface-muted',
  danger:
    'bg-danger text-danger-foreground hover:opacity-90 active:opacity-80',
  link: 'bg-transparent text-primary underline-offset-4 hover:underline px-0 h-auto',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  // Buttons read as UI, not body copy — text-sm at md keeps labels crisp while
  // the h-11 target stays touch-friendly. lg keeps text-base for prominent CTAs.
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-11 w-11 p-0',
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
