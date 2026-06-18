import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requireRolePage } from '@/lib/dal'
import { getAssignedLearners, getOwnLogs } from './_data'
import { LogForm } from './log-form'
import { EscalateButton } from './escalate-button'
import type { EscalationStatus } from '@/types/database'

export const metadata: Metadata = { title: 'Follow-through — Mission ON' }

const STATUS_LABEL: Record<EscalationStatus, string> = {
  open: 'Escalation open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
}
const STATUS_VARIANT: Record<
  EscalationStatus,
  'warning' | 'info' | 'success'
> = {
  open: 'warning',
  acknowledged: 'info',
  resolved: 'success',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Mentor follow-through: log confidential interactions and raise safeguarding
 * escalations. Strictly mentor-only (group layout + this page-level gate).
 */
export default async function FollowThroughPage() {
  // Page-level gate (mentor group is single-role; this is belt-and-braces).
  await requireRolePage(['mentor'])

  const [learners, logs] = await Promise.all([
    getAssignedLearners(),
    getOwnLogs(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Follow-through</h1>
        <p className="mt-1 text-ink-muted">
          Record your one-on-one sessions. Notes are confidential to you unless a
          safeguarding escalation is raised.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log a follow-through</CardTitle>
          <CardDescription>
            Pick the learner (shown by alias), write your notes, and flag for
            safeguarding only if there is genuine risk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogForm learners={learners} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your recent logs</CardTitle>
          <CardDescription>
            Only you can see these. Escalated cases are visible to the
            safeguarding team while the escalation stays open.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-ink-muted">No logs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {log.learnerAlias}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2 text-ink-muted">
                        {log.notes ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.escalationStatus ? (
                        <Badge variant={STATUS_VARIANT[log.escalationStatus]}>
                          {STATUS_LABEL[log.escalationStatus]}
                        </Badge>
                      ) : log.safeguardingEscalated ? (
                        <Badge variant="warning">Flagged</Badge>
                      ) : (
                        <Badge variant="neutral">Confidential</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-muted">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.escalationStatus === 'open' ||
                      log.escalationStatus === 'acknowledged' ? (
                        <span className="text-xs text-ink-muted">
                          Under review
                        </span>
                      ) : (
                        <EscalateButton
                          logId={log.id}
                          learnerAlias={log.learnerAlias}
                        />
                      )}
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
