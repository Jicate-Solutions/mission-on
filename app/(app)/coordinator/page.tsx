import type { Metadata } from 'next'
import Link from 'next/link'

import { StatCard, StatGrid } from '@/components/dashboard/stat-card'
import { DashboardSection } from '@/components/dashboard/dashboard-section'
import { BreakdownList } from '@/components/dashboard/breakdown-list'
import { NotificationBell } from '@/components/dashboard/notification-bell'
import { Badge } from '@/components/ui/badge'
import { STAGE_LABEL, SCHOOL_STATUS_LABEL } from '@/components/dashboard/labels'
import { getCoordinatorOverview } from '@/app/(app)/coordinator/dashboard/dashboard-data'
import { getOwnNotifications } from '@/app/api/notifications/notifications-data'

export const metadata: Metadata = { title: 'Coordinator — Mission ON' }

export const dynamic = 'force-dynamic'

/**
 * coordinator home dashboard (PRD §9.3). Shows ONLY the coordinator's own
 * schools, grouped by pipeline stage, with NO classification anywhere (module
 * codes are admin-only). Auth enforced by the group layout and re-verified in
 * the data call; RLS scopes the school rows to this coordinator.
 */
export default async function CoordinatorHome() {
  const [overview, feed] = await Promise.all([
    getCoordinatorOverview(),
    getOwnNotifications(20),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">My schools</h1>
          <p className="mt-1 text-ink-muted">
            Move your schools through the pipeline and issue questionnaires.
            Classification results stay with Admins.
          </p>
        </div>
        <NotificationBell initialFeed={feed} />
      </div>

      <StatGrid>
        <StatCard
          label="My schools"
          value={overview.totalSchools}
          href="/coordinator/schools"
        />
        {overview.stageCounts.map((s) => (
          <StatCard
            key={s.stage}
            label={STAGE_LABEL[s.stage]}
            value={s.count}
            tone={s.count > 0 ? 'brand' : 'neutral'}
          />
        ))}
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardSection
          title="By stage"
          description="Where your schools are in the journey."
          action={{ label: 'Pipeline', href: '/coordinator/pipeline' }}
        >
          <BreakdownList
            rows={overview.stageCounts.map((s) => ({
              label: STAGE_LABEL[s.stage],
              count: s.count,
            }))}
          />
        </DashboardSection>

        <DashboardSection
          title="Recent schools"
          description="Most recently updated."
          action={{ label: 'All schools', href: '/coordinator/schools' }}
        >
          {overview.schools.length === 0 ? (
            <p className="text-sm text-ink-muted">
              You have no schools yet. New schools you own will appear here.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {overview.schools.map((s) => (
                <li key={s.id}>
                  <Link
                    href="/coordinator/schools"
                    className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-brand-700"
                  >
                    <span className="font-medium text-ink">{s.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="neutral">{STAGE_LABEL[s.stage]}</Badge>
                      <span className="text-xs text-ink-muted">
                        {SCHOOL_STATUS_LABEL[s.status]}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>
      </div>
    </div>
  )
}
