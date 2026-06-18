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
import { NotificationBell } from '@/components/dashboard/notification-bell'
import {
  getOwnLearnerAlias,
  getOwnChosenMentor,
} from '@/app/(app)/learner/_data/selection'
import { getOwnNotifications } from '@/app/api/notifications/notifications-data'

export const metadata: Metadata = { title: 'Home — Mission ON' }

export const dynamic = 'force-dynamic'

/**
 * Learner home. Shows the learner's OWN alias (profile), their chosen mentor by
 * ALIAS, and the entry point to choose / change a mentor and to seek help.
 *
 * Every value on this page is alias-only: getOwnLearnerAlias() and
 * getOwnChosenMentor() never read real-identity tables. Auth is enforced by the
 * learner-only group layout and re-verified inside each data call.
 */
export default async function LearnerHome() {
  const [alias, chosen, feed] = await Promise.all([
    getOwnLearnerAlias(),
    getOwnChosenMentor(),
    getOwnNotifications(20),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            Welcome{alias ? `, ${alias}` : ''}
          </h1>
          <p className="mt-1 text-ink-muted">
            A safe, confidential space to make smart choices.
          </p>
        </div>
        <NotificationBell initialFeed={feed} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your mentor</CardTitle>
            <CardDescription>
              Someone you can talk to in confidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {chosen ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold text-ink">
                  {chosen.mentor.alias}
                </span>
                {chosen.status === 'pending_change' ? (
                  <Badge variant="warning">Change pending</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                )}
              </div>
            ) : (
              <p className="text-ink-muted">
                You haven&apos;t chosen a mentor yet. Pick someone you trust.
              </p>
            )}
            <Link
              href="/learner/mentors"
              className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {chosen ? 'View or change mentor' : 'Choose a mentor'}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need to talk?</CardTitle>
            <CardDescription>You are always in control.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-ink-muted">
              You can use Anonymous chat any time — no names are stored there. Or
              share feedback about your sessions whenever you like.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/anonymous-chat"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Anonymous chat
              </Link>
              <Link
                href="/learner/feedback"
                className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Give feedback
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>You are in control</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-ink-muted">
            Choose a mentor you trust, see your sessions, and share feedback. What
            you talk about with your mentor stays private.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
