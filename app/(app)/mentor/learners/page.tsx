import type { Metadata } from 'next'
import Link from 'next/link'

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
import { getAssignedLearners } from '@/app/(app)/mentor/follow-through/_data'

export const metadata: Metadata = { title: 'My learners — Mission ON' }

// Per-mentor data — never cache.
export const dynamic = 'force-dynamic'

/**
 * Mentor's "My learners" (PRD §9.4). Lists the learners ACTIVELY assigned to the
 * calling mentor, ALIAS-FIRST — never a real name. Reuses the alias-safe
 * getAssignedLearners() from the follow-through data layer (which sources only
 * learner_public.alias + the opaque learner_profiles.id, under RLS). From here a
 * mentor jumps to follow-through to log a confidential session.
 */
export default async function MentorLearnersPage() {
  await requireRolePage(['mentor'])
  const learners = await getAssignedLearners()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My learners</h1>
        <p className="mt-1 text-ink-muted">
          The learners who chose you, shown by alias. You never see a learner&rsquo;s
          real identity unless a safeguarding escalation requires it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Assigned learners{' '}
            <Badge variant="neutral">{learners.length}</Badge>
          </CardTitle>
          <CardDescription>
            Open follow-through to record a one-on-one session for a learner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {learners.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No learners are assigned to you yet. When a learner selects you by
              alias, they appear here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner (alias)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learners.map((l) => (
                  <TableRow key={l.learnerPublicId}>
                    <TableCell className="font-medium text-ink">
                      {l.alias}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href="/mentor/follow-through"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Follow-through →
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
