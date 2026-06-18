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
import { listFeedbackForMentor } from '@/app/(app)/learner/feedback/mentor-feedback-dal'

export const metadata: Metadata = { title: 'Feedback — Mission ON' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Mentor feedback inbox. Shows feedback that the mentor's OWN learners sent to
 * them — ALIAS-FIRST, and with no learner reference at all when the learner
 * chose anonymity. NEVER renders a learner real name (the DAL read never touches
 * learner_profiles). STRICTLY mentor-only (group layout + this page-level gate).
 */
export default async function MentorFeedbackPage() {
  // Belt-and-braces: the mentor group layout already gates this.
  await requireRolePage(['mentor'])

  // Re-verifies mentor role internally; returns alias-only DTOs.
  const items = await listFeedbackForMentor()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Feedback</h1>
        <p className="mt-1 text-ink-muted">
          What your learners said about their sessions with you. You only ever
          see a learner&apos;s chosen name — never any real details — and nothing
          at all when they send feedback anonymously.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>From your learners</CardTitle>
          <CardDescription>
            Most recent first. Ratings are out of 5.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-ink-muted">No feedback yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Helpfulness</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.isAnonymous || !item.learnerAlias ? (
                        <Badge variant="info">Anonymous</Badge>
                      ) : (
                        <span className="font-medium text-ink">
                          {item.learnerAlias}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="brand">{item.answers.rating}/5</Badge>
                    </TableCell>
                    <TableCell className="text-ink-muted">
                      {item.answers.mentorHelpfulness
                        ? `${item.answers.mentorHelpfulness}/5`
                        : '—'}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2 text-ink-muted">
                        {item.answers.comment ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-muted">
                      {formatDate(item.createdAt)}
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
