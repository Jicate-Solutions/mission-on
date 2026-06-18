import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { QuestionnaireBuilder } from '@/components/questionnaires/questionnaire-builder'

import { getActiveTemplate } from '@/app/(app)/admin/questionnaires/_builder/queries'

export const metadata: Metadata = {
  title: 'Questionnaire builder — Super Admin — Mission ON',
}

// The template drives classification scoring: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * Super Admin Questionnaire Builder — the super_admin mirror of the admin builder
 * (PRD §7.3 / §15 Phase 2). Reuses the admin-guarded queries/actions
 * (is_admin_role covers super_admin) and the shared editor component. As
 * super_admin, the save action can ALSO bump program_config.active_template
 * _version (an admin save cannot — see _builder/actions.ts). Double-gated:
 * super-admin group layout + requireRolePage + the query re-verifies internally.
 */
export default async function SuperAdminQuestionnaireBuilderPage() {
  await requireRolePage(['super_admin'])

  const template = await getActiveTemplate()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Questionnaire builder</h1>
        <p className="mt-1 text-ink-muted">
          Edit the pre-session questionnaire. Saving publishes a new version and
          deactivates the previous one — questionnaires already issued keep their
          original version, so their scoring is never retroactively changed.
        </p>
      </div>

      <QuestionnaireBuilder template={template} />
    </div>
  )
}
