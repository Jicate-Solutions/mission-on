import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { ClassificationView } from '@/components/classification/classification-view'

import { getClassificationOverview } from '@/app/(app)/admin/classification/_data'

export const metadata: Metadata = {
  title: 'Classification — Super Admin — Mission ON',
}

// Classification is per-school sensitive data: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * SUPER_ADMIN program-wide Classification view (PRD §6). Same admin-guarded data
 * and presentational body as the admin page; super_admin has admin powers, so it
 * reuses getClassificationOverview (which admits both roles). The per-school
 * deep-links target /super-admin/questionnaires — the super_admin mirror of the
 * questionnaire detail + confirm flow, keeping super_admin inside its namespace.
 */
export default async function SuperAdminClassificationPage() {
  await requireRolePage(['super_admin'])

  const overview = await getClassificationOverview()

  return (
    <ClassificationView
      overview={overview}
      questionnaireBasePath="/super-admin/questionnaires"
    />
  )
}
