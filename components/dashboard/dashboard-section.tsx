import * as React from 'react'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// =============================================================================
// Mission ON — Smart Choices
// components/dashboard/dashboard-section.tsx — A titled card section for a
// dashboard, with an optional "view all" link in the header.
//
// PRESENTATIONAL ONLY. Server pages compose these around aggregate widgets.
// =============================================================================

export interface DashboardSectionProps {
  title: string
  description?: string
  /** Optional internal href shown as a small action in the header. */
  action?: { label: string; href: string }
  children: React.ReactNode
}

export function DashboardSection({
  title,
  description,
  action,
  children,
}: DashboardSectionProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <p className="text-sm text-ink-muted">{description}</p>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-brand-700 transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {action.label}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
