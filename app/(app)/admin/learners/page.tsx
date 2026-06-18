import type { Metadata } from 'next'

import { getMentorPublicList } from '@/lib/dal'
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
import type { LearnerAssignmentStatus } from '@/types/database'
import {
  getLearnerDirectory,
  getChangeRequests,
} from '@/app/(app)/admin/learners/_data/directory'
import { ChangeRequestReview } from './change-request-review'

export const metadata: Metadata = { title: 'Learners — Mission ON' }

function assignmentBadge(status: LearnerAssignmentStatus | null) {
  if (status === 'active') return <Badge variant="success">Active</Badge>
  if (status === 'pending_change')
    return <Badge variant="warning">Change pending</Badge>
  return <Badge variant="neutral">Unassigned</Badge>
}

/**
 * Admin learner directory + mentor-change review queue (PRD §9.5).
 *
 * ALIAS-ONLY: this oversight view shows learners and mentors by alias. Real
 * identity is NOT joined here; it is reached only via the gated/audited
 * getLearnerFull() on a dedicated detail flow. Auth: admin/super_admin group
 * layout + requireRole inside every data call below.
 */
export default async function AdminLearnersPage() {
  const [directory, openRequests, mentors] = await Promise.all([
    getLearnerDirectory(),
    getChangeRequests({ onlyOpen: true }),
    getMentorPublicList(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Learners</h1>
        <p className="mt-1 text-ink-muted">
          Learners and their mentors are shown by alias. Real identities stay
          protected and are revealed only through the safeguarding flow.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Mentor-change requests
            {openRequests.length > 0 ? (
              <Badge variant="warning" className="ml-2">
                {openRequests.length} open
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Approve (optionally reassigning a mentor) or reject. Learners can only
            have one open request at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {openRequests.length === 0 ? (
            <p className="text-ink-muted">No open requests.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {openRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-medium text-ink">
                      {req.learnerAlias ?? 'Learner'}
                    </p>
                    <p className="text-sm text-ink-muted">
                      Current mentor: {req.currentMentorAlias ?? 'none'}
                    </p>
                    {req.reason ? (
                      <p className="mt-1 max-w-prose text-sm text-ink">
                        &ldquo;{req.reason}&rdquo;
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-ink-muted">
                        No reason given.
                      </p>
                    )}
                  </div>
                  <div className="md:w-72">
                    <ChangeRequestReview
                      requestId={req.id}
                      mentors={mentors}
                      currentMentorPublicId={req.currentMentorPublicId}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learner directory</CardTitle>
          <CardDescription>
            {directory.length} learner{directory.length === 1 ? '' : 's'}, shown by
            alias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {directory.length === 0 ? (
            <p className="text-ink-muted">No learners yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directory.map((row) => (
                  <TableRow key={row.learnerPublicId}>
                    <TableCell className="font-medium">
                      {row.learnerAlias}
                    </TableCell>
                    <TableCell>
                      {row.mentorAlias ?? (
                        <span className="text-ink-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell>{assignmentBadge(row.assignmentStatus)}</TableCell>
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
