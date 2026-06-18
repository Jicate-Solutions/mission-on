import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { QuestionnaireBuilder } from '@/components/questionnaires/questionnaire-builder'

import { getActiveTemplate } from '../_builder/queries'

export const metadata: Metadata = {
  title: 'Questionnaire builder — Admin — Mission ON',
}

// The template drives classification scoring: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * Admin Questionnaire Builder (PRD §7.3 / §15 Phase 2). Lets an admin edit the
 * pre-session questionnaire template and publish a new version. Double-gated: the
 * admin route-group layout + requireRolePage here + every query/action
 * re-verifies admin internally.
 */
export default async function AdminQuestionnaireBuilderPage() {
  await requireRolePage(['admin', 'super_admin'])

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
