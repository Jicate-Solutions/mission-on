import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { DetailView } from '@/app/(app)/admin/safeguarding/detail-view'

export const metadata: Metadata = { title: 'Safeguarding case — Mission ON' }

/**
 * Super Admin safeguarding case detail. Reveals the confidential log + learner
 * identity (audited). super_admin only.
 */
export default async function SuperAdminSafeguardingCasePage({
  params,
}: {
  params: Promise<{ escalationId: string }>
}) {
  await requireRolePage(['super_admin'])
  const { escalationId } = await params

  return (
    <DetailView
      escalationId={escalationId}
      basePath="/super-admin/safeguarding"
    />
  )
}
