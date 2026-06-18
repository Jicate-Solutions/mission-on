import type { Metadata } from 'next'
import Link from 'next/link'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { requireRolePage } from '@/lib/dal'

import { getAdminQuestionnaireList } from '@/app/(app)/admin/questionnaires/_data'
import { QuestionnaireStatusBadge } from '@/app/(app)/coordinator/questionnaires/status-badge'

export const metadata: Metadata = {
  title: 'Questionnaire results — Super Admin — Mission ON',
}

// Classification is per-school sensitive data: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

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
  return <span>{Math.round(value * 100)}%</span>
}

/**
 * SUPER_ADMIN classification results list — the super_admin mirror of the admin
 * list. Shows the computed/confirmed module code, confidence and divergence flag;
 * visibility is restricted at the data layer (getAdminQuestionnaireList
 * re-verifies the role — is_admin_role covers super_admin). PRD §7.3.
 */
export default async function SuperAdminQuestionnairesPage() {
  await requireRolePage(['super_admin'])

  const rows = await getAdminQuestionnaireList()

  const diverged = rows.filter((r) => r.divergenceFlag).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Questionnaire results
        </h1>
        <p className="mt-1 text-ink-muted">
          Auto-computed module classifications for each school. These results are
          visible to Admins and Super Admins only — never to schools or
          coordinators.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All responses</CardTitle>
          <CardDescription>
            {rows.length === 0
              ? 'No questionnaires have been issued yet.'
              : `${rows.length} response${rows.length === 1 ? '' : 's'}${
                  diverged > 0
                    ? ` · ${diverged} flagged for divergence review`
                    : ''
                }.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-ink-muted">
              Once coordinators issue questionnaires and schools respond,
              classifications appear here for confirmation.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.schoolName}
                    </TableCell>
                    <TableCell>
                      <QuestionnaireStatusBadge status={r.status} />
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
                        href={`/super-admin/questionnaires/${r.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
                      >
                        Open
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
