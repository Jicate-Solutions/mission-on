import type { Metadata } from 'next'

import { StatCard, StatGrid } from '@/components/dashboard/stat-card'
import { DashboardSection } from '@/components/dashboard/dashboard-section'
import { BreakdownList } from '@/components/dashboard/breakdown-list'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { STAGE_LABEL } from '@/components/dashboard/labels'
import { getAdminOverview } from '@/app/(app)/admin/dashboard/dashboard-data'
import { getOwnNotifications } from '@/app/api/notifications/notifications-data'

export const metadata: Metadata = { title: 'Admin — Mission ON' }

export const dynamic = 'force-dynamic'

/**
 * admin home dashboard (PRD §9.2). AGGREGATES only: pipeline board, module-code
 * distribution, divergence-confirmation queue, mentor-change requests, bug
 * queue, and feedback aggregates (total + anonymous share — never per-learner).
 * Auth enforced by the group layout (admin + super_admin) and re-verified in the
 * data call.
 */
export default async function AdminHome() {
  const [overview, feed] = await Promise.all([
    getAdminOverview(),
    getOwnNotifications(20),
  ])

  const anonShare =
    overview.feedbackTotal > 0
      ? Math.round((overview.feedbackAnonymous / overview.feedbackTotal) * 100)
      : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Admin overview</h1>
          <p className="mt-1 text-ink-muted">
            Run the pipeline, confirm classifications, allocate mentors and
            review feedback. Schools never see their own classification.
          </p>
        </div>
        <NotificationBell initialFeed={feed} />
      </div>

      <StatGrid>
        <StatCard
          label="Schools"
          value={overview.totalSchools}
          hint={`${overview.classifiedSchools} classified`}
          href="/admin/schools"
        />
        <StatCard
          label="Divergence to confirm"
          value={overview.divergencePending}
          tone={overview.divergencePending > 0 ? 'warning' : 'success'}
          hint="Manual review"
          href="/admin/classification"
        />
        <StatCard
          label="Mentor changes"
          value={overview.openMentorChanges}
          tone={overview.openMentorChanges > 0 ? 'warning' : 'neutral'}
          hint="Open requests"
          href="/admin/mentor-changes"
        />
        <StatCard
          label="Open bugs"
          value={overview.openBugs}
          tone={overview.openBugs > 0 ? 'warning' : 'neutral'}
          href="/bug-reports"
        />
        <StatCard
          label="Feedback"
          value={overview.feedbackTotal}
          hint={`${anonShare}% anonymous`}
          href="/admin/feedback"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardSection
          title="Pipeline board"
          description="All schools by stage."
          action={{ label: 'Schools', href: '/admin/schools' }}
        >
          <BreakdownList
            rows={overview.stageCounts.map((s) => ({
              label: STAGE_LABEL[s.stage],
              count: s.count,
            }))}
          />
        </DashboardSection>

        <DashboardSection
          title="Module codes"
          description="Confirmed classification distribution."
          action={{ label: 'Classification', href: '/admin/classification' }}
        >
          <BreakdownList
            rows={overview.moduleCounts.map((m) => ({
              label: m.code,
              count: m.count,
              badgeVariant: 'brand' as const,
            }))}
            emptyText="No schools have a confirmed module code yet."
          />
        </DashboardSection>
      </div>
    </div>
  )
}
