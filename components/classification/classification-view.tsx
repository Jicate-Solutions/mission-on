import * as React from 'react'

import { StatCard, StatGrid } from '@/components/dashboard/stat-card'
import { DashboardSection } from '@/components/dashboard/dashboard-section'
import { ClassificationMatrix } from '@/components/classification/classification-matrix'
import { SchoolClassificationTable } from '@/components/classification/school-classification-table'
import type { ClassificationOverview } from '@/app/(app)/admin/classification/_data'

// =============================================================================
// Mission ON — Smart Choices
// components/classification/classification-view.tsx — the shared, presentational
// body of the program-wide Classification view (PRD §6), reused by the admin and
// super-admin pages. The caller fetches the admin-guarded overview and passes
// the questionnaire base path so the per-school deep-links stay in its namespace.
// =============================================================================

export function ClassificationView({
  overview,
  questionnaireBasePath,
}: {
  overview: ClassificationOverview
  questionnaireBasePath: string
}) {
  const { totalClassified, totalConfirmed, totalDiverged, totalUnclassified } =
    overview

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Classification</h1>
        <p className="mt-1 text-ink-muted">
          Program-wide view of each school&rsquo;s computed module code from the
          3×3 matrix, with divergence flags surfaced for manual confirmation.
          Visible to Admins and Super Admins only — never to schools or
          coordinators.
        </p>
      </div>

      <StatGrid>
        <StatCard
          label="Classified schools"
          value={totalClassified}
          hint="With a computed or confirmed code"
        />
        <StatCard
          label="Confirmed"
          value={totalConfirmed}
          tone="brand"
          hint="Module code locked by an Admin"
        />
        <StatCard
          label="Divergence flags"
          value={totalDiverged}
          tone={totalDiverged > 0 ? 'warning' : 'success'}
          hint="Awaiting manual confirmation"
        />
        <StatCard
          label="Awaiting classification"
          value={totalUnclassified}
          tone={totalUnclassified > 0 ? 'info' : 'neutral'}
          hint="Response in, code not yet computed"
        />
      </StatGrid>

      <DashboardSection
        title="3×3 matrix distribution"
        description="Schools by effective module code (confirmed where present, otherwise computed). Rows: Category A — demographic. Columns: Category B — behaviour."
      >
        <ClassificationMatrix cells={overview.matrix} />
      </DashboardSection>

      <DashboardSection
        title="Schools"
        description={
          totalDiverged > 0
            ? `${totalDiverged} school${
                totalDiverged === 1 ? '' : 's'
              } flagged for divergence — open to review and confirm the module code.`
            : 'Every classified school and its module code.'
        }
      >
        <SchoolClassificationTable
          rows={overview.schools}
          questionnaireBasePath={questionnaireBasePath}
        />
      </DashboardSection>
    </div>
  )
}
