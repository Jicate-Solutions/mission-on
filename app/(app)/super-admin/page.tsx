import type { Metadata } from 'next'

import { StatCard, StatGrid } from '@/components/dashboard/stat-card'
import { DashboardSection } from '@/components/dashboard/dashboard-section'
import { BreakdownList } from '@/components/dashboard/breakdown-list'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { STAGE_LABEL } from '@/components/dashboard/labels'
import { getSuperAdminOverview } from '@/app/(app)/super-admin/dashboard/dashboard-data'
import { getOwnNotifications } from '@/app/api/notifications/notifications-data'

export const metadata: Metadata = { title: 'Super Admin — Mission ON' }

// Per-user, classification-bearing data — never cache.
export const dynamic = 'force-dynamic'

/**
 * super_admin home dashboard (PRD §9.1). Program-wide AGGREGATES only: school
 * counts, pipeline stages, confirmed module-code distribution, and the oversight
 * queues (escalations, bugs, moderation, mentor changes). No raw confidential
 * rows reach this page. Auth is enforced by the group layout and re-verified in
 * each data call.
 */
export default async function SuperAdminHome() {
  const [overview, feed] = await Promise.all([
    getSuperAdminOverview(),
    getOwnNotifications(20),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">System overview</h1>
          <p className="mt-1 text-ink-muted">
            Full oversight of schools, classification, safeguarding and the
            program queues.
          </p>
        </div>
        <NotificationBell initialFeed={feed} />
      </div>

      <StatGrid>
        <StatCard
          label="Schools"
          value={overview.totalSchools}
          hint={`${overview.schoolsClassified} classified`}
          href="/super-admin/schools"
        />
        <StatCard
          label="Open escalations"
          value={overview.openEscalations}
          tone={overview.openEscalations > 0 ? 'danger' : 'success'}
          hint="Safeguarding"
          href="/super-admin/safeguarding"
        />
        <StatCard
          label="Mentor changes"
          value={overview.openMentorChanges}
          tone={overview.openMentorChanges > 0 ? 'warning' : 'neutral'}
          hint="Awaiting decision"
          href="/super-admin/mentor-changes"
        />
        <StatCard
          label="Open bugs"
          value={overview.openBugs}
          tone={overview.openBugs > 0 ? 'warning' : 'neutral'}
          href="/bug-reports"
        />
        <StatCard
          label="Hidden anon posts"
          value={overview.hiddenAnonPosts}
          hint="Moderation"
          href="/anonymous-chat"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardSection
          title="Pipeline"
          description="Schools by stage across the whole program."
          action={{ label: 'Schools', href: '/super-admin/schools' }}
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
          description="Confirmed classification distribution (admin-visible)."
          action={{
            label: 'Classification',
            href: '/super-admin/classification',
          }}
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
