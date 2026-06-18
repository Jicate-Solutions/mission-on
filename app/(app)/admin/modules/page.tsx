import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { WorkspaceView } from '@/components/modules/workspace-view'

import { listWorkspaceSessions } from './_lib/queries'

export const metadata: Metadata = { title: 'Modules — Admin — Mission ON' }

// Admin-only planning data (module codes): always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * Admin Module Design Workspace index (PRD §7.4). Lists every session with its
 * school's confirmed/computed module code and the designed planning module.
 * Double-gated: the admin route-group layout + requireRolePage here + the query
 * re-verifies admin internally.
 */
export default async function AdminModulesPage() {
  await requireRolePage(['admin', 'super_admin'])

  const sessions = await listWorkspaceSessions()

  return <WorkspaceView sessions={sessions} basePath="/admin/modules" />
}
