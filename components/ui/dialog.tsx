'use client'

import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Accessible modal dialog built on the native <dialog> element.
 * No external UI library. Uses the platform's focus trap, Escape handling,
 * and ::backdrop. Controlled via the `open` prop.
 */
export interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** Accessible label id; defaults wire title/description automatically. */
  labelledBy?: string
  describedBy?: string
  className?: string
}

export function Dialog({
  open,
  onClose,
  children,
  labelledBy,
  describedBy,
  className,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open && !node.open) {
      node.showModal()
    } else if (!open && node.open) {
      node.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClose={onClose}
      onClick={(e) => {
        // Close when the backdrop (the dialog element itself) is clicked.
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-surface p-0 text-ink shadow-[var(--shadow-card)]',
        'backdrop:bg-ink/40',
        className
      )}
    >
      {open ? children : null}
    </dialog>
  )
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1 p-6 pb-3', className)}
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-lg font-semibold text-ink', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-ink-muted', className)} {...props} />
  )
}

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-2', className)} {...props} />
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 p-6 pt-3',
        className
      )}
      {...props}
    />
  )
}

export function DialogClose({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label="Close dialog"
      onClick={onClick}
      className={cn(
        'absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className
      )}
      {...props}
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}
