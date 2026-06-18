import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { ClassificationView } from '@/components/classification/classification-view'

import { getClassificationOverview } from './_data'

export const metadata: Metadata = {
  title: 'Classification — Admin — Mission ON',
}

// Classification is per-school sensitive data: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * ADMIN / SUPER_ADMIN program-wide Classification view (PRD §6). Shows the 3×3
 * matrix distribution and a per-school list with divergence flags highlighted,
 * each deep-linking to the questionnaire detail to confirm a divergent code.
 * The group layout allows [admin, super_admin]; this page-level gate is
 * belt-and-braces, and the data layer re-verifies the role.
 */
export default async function AdminClassificationPage() {
  await requireRolePage(['admin', 'super_admin'])

  const overview = await getClassificationOverview()

  return (
    <ClassificationView
      overview={overview}
      questionnaireBasePath="/admin/questionnaires"
    />
  )
}
