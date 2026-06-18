import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireRolePage } from '@/lib/dal'
import { SessionDesignView } from '@/components/modules/session-design-view'

import { getSessionDesignDetail } from '../_lib/queries'

export const metadata: Metadata = { title: 'Module design — Admin — Mission ON' }

// Admin-only planning data: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * Admin module design for one session (PRD §7.4): set the planning module code +
 * delivery-plan brief (session_design) and manage the per-session Mentor team
 * (session_mentors).
 * Double-gated: admin route-group layout + requireRolePage + the query
 * re-verifies admin internally.
 */
export default async function AdminModuleDesignPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  await requireRolePage(['admin', 'super_admin'])
  const { sessionId } = await params

  const detail = await getSessionDesignDetail(sessionId)
  if (!detail) notFound()

  return <SessionDesignView detail={detail} basePath="/admin/modules" />
}
