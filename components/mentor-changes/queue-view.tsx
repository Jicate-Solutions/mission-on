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
import type { MentorChangeStatus } from '@/types/database'

import {
  listChangeRequests,
  listMentorOptions,
  type ChangeRequestItem,
} from './_data'
import { RequestActions } from './request-actions'

const STATUS_LABEL: Record<MentorChangeStatus, string> = {
  open: 'Open',
  approved: 'Approved',
  rejected: 'Rejected',
}
const STATUS_VARIANT: Record<MentorChangeStatus, 'warning' | 'success' | 'neutral'> =
  {
    open: 'warning',
    approved: 'success',
    rejected: 'neutral',
  }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Shared mentor-change request queue, rendered by both the admin and super-admin
 * pages. Shows ALIASES ONLY (learner + current mentor). Open requests can be
 * approved (which opens the mentor switch) or rejected; resolved requests are
 * listed for the record. No real learner/mentor identity is ever surfaced here.
 */
export async function MentorChangeQueueView() {
  const [requests, mentorOptions] = await Promise.all([
    listChangeRequests(),
    listMentorOptions(),
  ])

  const open = requests.filter((r) => r.status === 'open')
  const resolved = requests.filter((r) => r.status !== 'open')

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Open requests</CardTitle>
          <CardDescription>
            {open.length} request{open.length === 1 ? '' : 's'} awaiting review.
            Approve to open the switch (pick a new mentor by alias), or reject to
            keep the current mentor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No open mentor-change requests.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Current mentor</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.learnerAlias}
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {r.currentMentorAlias ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2 text-ink-muted">
                        {r.reason ?? 'No reason given.'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-muted">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RequestActions
                        requestId={r.id}
                        learnerPublicId={r.learnerPublicId}
                        currentMentorPublicId={r.currentMentorPublicId}
                        mentorOptions={mentorOptions}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolved requests</CardTitle>
          <CardDescription>
            Approved and rejected requests, for the record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resolved.length === 0 ? (
            <p className="text-sm text-ink-muted">No resolved requests yet.</p>
          ) : (
            <ResolvedTable items={resolved} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ResolvedTable({ items }: { items: ChangeRequestItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Learner</TableHead>
          <TableHead>Current mentor (at request)</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead>Resolved</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-medium">{r.learnerAlias}</TableCell>
            <TableCell className="text-ink-muted">
              {r.currentMentorAlias ?? '—'}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[r.status]}>
                {STATUS_LABEL[r.status]}
              </Badge>
            </TableCell>
            <TableCell className="whitespace-nowrap text-ink-muted">
              {r.resolvedAt ? formatDate(r.resolvedAt) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
