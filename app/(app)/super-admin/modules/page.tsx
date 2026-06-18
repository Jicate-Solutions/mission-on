import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { WorkspaceView } from '@/components/modules/workspace-view'

import { listWorkspaceSessions } from '@/app/(app)/admin/modules/_lib/queries'

export const metadata: Metadata = {
  title: 'Modules — Super Admin — Mission ON',
}

// Admin-only planning data (module codes): always server-rendered, never cached.
export const dynamic = 'force-dynamic'

/**
 * Super Admin Module Design Workspace — the super_admin mirror of the admin
 * workspace. Reuses the admin-guarded queries (is_admin_role covers super_admin)
 * and the shared presentational view, with super-admin deep links. Double-gated:
 * super-admin group layout + requireRolePage + the query re-verifies internally.
 */
export default async function SuperAdminModulesPage() {
  await requireRolePage(['super_admin'])

  const sessions = await listWorkspaceSessions()

  return <WorkspaceView sessions={sessions} basePath="/super-admin/modules" />
}
