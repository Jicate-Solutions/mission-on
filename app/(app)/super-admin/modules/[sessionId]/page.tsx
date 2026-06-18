import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireRolePage } from '@/lib/dal'
import { SessionDesignView } from '@/components/modules/session-design-view'

import { getSessionDesignDetail } from '@/app/(app)/admin/modules/_lib/queries'

export const metadata: Metadata = {
  title: 'Module design — Super Admin — Mission ON',
}

// Admin-only planning data: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * Super Admin module design for one session — the super_admin mirror of the
 * admin design page. Reuses the admin-guarded query + shared view, with
 * super-admin deep links. The write actions (attach module, assign mentors)
 * admit super_admin via requireRole(['admin','super_admin']). Double-gated.
 */
export default async function SuperAdminModuleDesignPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  await requireRolePage(['super_admin'])
  const { sessionId } = await params

  const detail = await getSessionDesignDetail(sessionId)
  if (!detail) notFound()

  return (
    <SessionDesignView detail={detail} basePath="/super-admin/modules" />
  )
}
