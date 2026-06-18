import * as React from 'react'

import { cn } from '@/lib/utils'

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('bg-surface-muted [&_tr]:border-b', className)}
      {...props}
    />
  )
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

export function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-border bg-surface transition-colors hover:bg-surface-muted/60',
        className
      )}
      {...props}
    />
  )
}

export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-11 px-4 text-left align-middle font-semibold text-ink-muted',
        className
      )}
      {...props}
    />
  )
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-3 align-middle text-ink', className)}
      {...props}
    />
  )
}

export function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('mt-3 text-sm text-ink-muted', className)}
      {...props}
    />
  )
}
