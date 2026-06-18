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

import { getCoordinatorQuestionnaires } from './_data'
import { QuestionnaireStatusBadge } from './status-badge'

export const metadata: Metadata = {
  title: 'Questionnaires — Coordinator — Mission ON',
}

// Per-user, classification-sensitive context: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Coordinator questionnaire tracker. Lists the coordinator's schools with the
 * fixed questionnaire's lifecycle status. Classification is NEVER shown here —
 * the data layer reads only the classification-free coordinator view.
 */
export default async function CoordinatorQuestionnairesPage() {
  const rows = await getCoordinatorQuestionnaires()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Questionnaires</h1>
        <p className="mt-1 text-ink-muted">
          Issue the pre-session questionnaire to your schools (about a week
          before the session) and track completion. Classification results are
          handled by Admins — they are not shown here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>My schools</CardTitle>
          <CardDescription>
            {rows.length === 0
              ? 'You do not own any schools yet.'
              : `${rows.length} school${rows.length === 1 ? '' : 's'}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-ink-muted">
              When a school is assigned to you, it will appear here so you can
              issue and track its questionnaire.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Questionnaire</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.schoolId}>
                    <TableCell className="font-medium">{r.schoolName}</TableCell>
                    <TableCell>
                      <QuestionnaireStatusBadge status={r.questionnaireStatus} />
                    </TableCell>
                    <TableCell>{fmtDate(r.issuedAt)}</TableCell>
                    <TableCell>{fmtDate(r.completedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/coordinator/questionnaires/${r.schoolId}`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
                      >
                        Manage
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
