import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { DetailView } from '../detail-view'

export const metadata: Metadata = { title: 'Safeguarding case — Mission ON' }

/**
 * Admin safeguarding case detail. Reveals the confidential log + learner
 * identity (audited). Allowed for [admin, super_admin].
 */
export default async function AdminSafeguardingCasePage({
  params,
}: {
  params: Promise<{ escalationId: string }>
}) {
  await requireRolePage(['admin', 'super_admin'])
  const { escalationId } = await params

  return <DetailView escalationId={escalationId} basePath="/admin/safeguarding" />
}
