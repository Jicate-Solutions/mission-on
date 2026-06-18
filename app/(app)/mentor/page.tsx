import type { Metadata } from 'next'
import Link from 'next/link'

import { StatCard, StatGrid } from '@/components/dashboard/stat-card'
import { DashboardSection } from '@/components/dashboard/dashboard-section'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getMentorOverview } from '@/app/(app)/mentor/dashboard/dashboard-data'
import { getOwnNotifications } from '@/app/api/notifications/notifications-data'

export const metadata: Metadata = { title: 'Mentor — Mission ON' }

export const dynamic = 'force-dynamic'

/**
 * mentor home dashboard (PRD §9.4). ALIAS-FIRST and self-scoped: the mentor's
 * own alias, assigned schools (name only), assigned learners shown by ALIAS
 * ONLY, availability and feedback counts. Learner real identity is NEVER shown
 * here — that is reveal-on-safeguarding only, via a different path. Auth enforced
 * by the mentor-only group layout and re-verified in the data call.
 */
export default async function MentorHome() {
  const [overview, feed] = await Promise.all([
    getMentorOverview(),
    getOwnNotifications(20),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            Welcome{overview.alias ? `, ${overview.alias}` : ''}
          </h1>
          <p className="mt-1 text-ink-muted">
            Your one-on-one conversations are confidential. Learners are shown by
            alias unless a safeguarding escalation reveals identity.
          </p>
        </div>
        <NotificationBell initialFeed={feed} />
      </div>

      {!overview.hasProfile ? (
        <Card>
          <CardHeader>
            <CardTitle>Finish setting up your profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-ink-muted">
              You don&apos;t have a mentor profile and alias yet. Set one up so
              learners can find you by alias.
            </p>
            <Link
              href="/mentor/profile"
              className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Go to profile
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <StatGrid>
            <StatCard
              label="Assigned learners"
              value={overview.learners.length}
              hint="By alias"
              href="/mentor/learners"
            />
            <StatCard
              label="Assigned schools"
              value={overview.assignedSchools.length}
            />
            <StatCard
              label="Upcoming availability"
              value={overview.upcomingAvailability}
              tone={overview.upcomingAvailability === 0 ? 'warning' : 'success'}
              hint="Slots"
              href="/mentor/availability"
            />
            <StatCard
              label="Feedback"
              value={overview.feedbackCount}
              href="/mentor/feedback"
            />
          </StatGrid>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <DashboardSection
              title="My learners"
              description="Shown by alias. Tap to open follow-through."
              action={{ label: 'All learners', href: '/mentor/learners' }}
            >
              {overview.learners.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No learners assigned yet.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {overview.learners.map((l) => (
                    <li key={l.id}>
                      <Badge variant="brand">{l.alias}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardSection>

            <DashboardSection
              title="My schools"
              description="Schools you support."
            >
              {overview.assignedSchools.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No schools allocated yet.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {overview.assignedSchools.map((s) => (
                    <li
                      key={s.id}
                      className="py-2.5 text-sm font-medium text-ink"
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </DashboardSection>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Confidential by design</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-ink-muted">
                Use{' '}
                <Link
                  href="/mentor/follow-through"
                  className="font-medium text-brand-700 hover:underline"
                >
                  Follow-through
                </Link>{' '}
                to record sessions and raise a safeguarding escalation when a
                learner may be at risk. Identity is revealed only when an
                escalation is active.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
