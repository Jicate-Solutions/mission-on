import * as React from 'react'
import Link from 'next/link'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SchoolClassificationItem } from '@/app/(app)/admin/classification/_data'

// =============================================================================
// Mission ON — Smart Choices
// components/classification/school-classification-table.tsx — per-school
// classification list (PRD §6). PRESENTATIONAL ONLY: the caller (an admin /
// super_admin server page) passes admin-guarded DTOs. Divergent schools are
// highlighted and deep-link to the questionnaire detail to confirm/lock the
// module code. `questionnaireBasePath` keeps the link inside the caller's
// namespace (e.g. /admin/questionnaires).
// =============================================================================

function ModuleCell({
  computed,
  confirmed,
}: {
  computed: string | null
  confirmed: string | null
}) {
  if (confirmed) {
    return <Badge variant="brand">{confirmed} (confirmed)</Badge>
  }
  if (computed) {
    return <Badge variant="info">{computed}</Badge>
  }
  return <span className="text-ink-muted">—</span>
}

function ConfidenceCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-muted">—</span>
  return <span className="tabular-nums">{Math.round(value * 100)}%</span>
}

export function SchoolClassificationTable({
  rows,
  questionnaireBasePath,
}: {
  rows: SchoolClassificationItem[]
  /** Base path of the questionnaire detail route, e.g. "/admin/questionnaires". */
  questionnaireBasePath: string
}) {
  if (rows.length === 0) {
    return (
      <p className="text-ink-muted">
        No schools have been classified yet. Once coordinators issue
        questionnaires and schools respond, classifications appear here.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>School</TableHead>
          <TableHead>Computed</TableHead>
          <TableHead>Confirmed / effective</TableHead>
          <TableHead>Confidence</TableHead>
          <TableHead>Flag</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.responseId}
            className={cn(
              r.divergenceFlag &&
                'bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)]'
            )}
          >
            <TableCell className="font-medium">{r.schoolName}</TableCell>
            <TableCell>
              {r.computedModuleCode ? (
                <Badge variant="info">{r.computedModuleCode}</Badge>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
            </TableCell>
            <TableCell>
              <ModuleCell
                computed={r.computedModuleCode}
                confirmed={r.confirmedModuleCode}
              />
            </TableCell>
            <TableCell>
              <ConfidenceCell value={r.confidence} />
            </TableCell>
            <TableCell>
              {r.divergenceFlag ? (
                <Badge variant="warning">Divergence</Badge>
              ) : (
                <span className="text-ink-muted">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`${questionnaireBasePath}/${r.responseId}`}
                className="inline-flex h-9 items-center justify-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                {r.divergenceFlag && !r.confirmedModuleCode
                  ? 'Review & confirm'
                  : 'Open'}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
