import { cn } from '@/lib/utils'

type BrandMarkSize = 'sm' | 'lg'

const sizeClasses: Record<BrandMarkSize, string> = {
  sm: 'size-8 rounded-lg text-xs',
  lg: 'size-14 rounded-2xl text-lg',
}

const dotClasses: Record<BrandMarkSize, string> = {
  sm: 'size-2 -right-0.5 -top-0.5 ring-2',
  lg: 'size-3 right-0 top-0 ring-[3px]',
}

/**
 * The Mission ON brand mark — the app's signature element.
 *
 * The product name is the metaphor: a switch that's "ON". The green tile carries
 * the JKKN identity; the small yellow dot reads as a power/indicator light that
 * is lit. On the auth screen (`glow`) it gains a soft ring so it acts as the
 * hero. Purely decorative — callers supply the visible "Mission ON" wordmark, so
 * this is aria-hidden.
 */
export function BrandMark({
  size = 'sm',
  glow = false,
  className,
}: {
  size?: BrandMarkSize
  glow?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-flex shrink-0', className)}
    >
      <span
        className={cn(
          'flex items-center justify-center bg-primary font-bold tracking-tight text-primary-foreground',
          'font-[family-name:var(--font-display)]',
          glow &&
            'shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--color-primary)_55%,transparent)] ring-4 ring-brand-100',
          sizeClasses[size]
        )}
      >
        ON
      </span>
      {/* Yellow "power-on" indicator — the single accent use. */}
      <span
        className={cn(
          'absolute rounded-full bg-accent ring-surface',
          dotClasses[size]
        )}
      />
    </span>
  )
}
