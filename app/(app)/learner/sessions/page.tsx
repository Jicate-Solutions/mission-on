import type { Metadata } from 'next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requireRolePage } from '@/lib/dal'
import { SESSION_STATUS_LABELS } from '@/app/api/schools/_lib/pipeline.constants'
import { getOwnSchoolSessions } from './_data'

export const metadata: Metadata = { title: 'My sessions — Mission ON' }

export const dynamic = 'force-dynamic'

function dash(v: string | null): string {
  return v === null || v === '' ? '—' : v
}

/**
 * Learner sessions (PRD §9.5). The awareness / follow-through sessions for the
 * learner's own school — logistics only (grade, date, day, time, status). The
 * module a session covers is never shown to learners; the data layer never reads
 * it. Page is dynamic (per-user).
 */
export default async function LearnerSessionsPage() {
  await requireRolePage(['learner'])
  const sessions = await getOwnSchoolSessions()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Your sessions</h1>
        <p className="mt-1 text-ink-muted">
          Awareness and follow-through sessions at your school. Here you can see
          when each one is happening.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-ink-muted">
              No sessions are scheduled for your school yet. Check back soon.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-ink">
                      {dash(s.grade)}
                    </TableCell>
                    <TableCell>{dash(s.sessionDate)}</TableCell>
                    <TableCell>{dash(s.dayOfWeek)}</TableCell>
                    <TableCell>{dash(s.startTime)}</TableCell>
                    <TableCell>
                      <Badge variant="info">
                        {SESSION_STATUS_LABELS[s.status]}
                      </Badge>
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
