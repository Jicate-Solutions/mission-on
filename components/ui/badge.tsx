import * as React from 'react'

import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-muted text-ink-muted',
  brand: 'bg-brand-100 text-brand-800',
  success: 'bg-[color-mix(in_srgb,var(--color-success)_15%,white)] text-success',
  warning: 'bg-[color-mix(in_srgb,var(--color-warning)_18%,white)] text-warning',
  danger: 'bg-[color-mix(in_srgb,var(--color-danger)_12%,white)] text-danger',
  info: 'bg-[color-mix(in_srgb,var(--color-info)_12%,white)] text-info',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({
  className,
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}
