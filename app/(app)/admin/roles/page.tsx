import type { Metadata } from 'next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireRolePage } from '@/lib/dal'

import { listUserRoles } from '@/app/api/roles/_lib/queries'
import { RoleRoster } from '@/components/roles/role-roster'

export const metadata: Metadata = { title: 'Roles — Admin — Mission ON' }

// Per-user sensitive admin data (auth user list + roles): never cache.
export const dynamic = 'force-dynamic'

/**
 * Admin role allocation (PRD §7.1, §11). Admins allocate/modify roles for new
 * joiners — promote a Learner to Mentor, add a School Coordinator, etc. — but
 * may NOT grant the Super Admin role nor modify an existing Super Admin (those
 * rows render locked). Super Admins use /super-admin/roles for full control.
 *
 * Gating: the admin route-group layout requires admin|super_admin; this page
 * re-asserts it, and listUserRoles + setUserRole each re-verify role internally
 * (the service-role read/write path makes that the real boundary).
 */
export default async function AdminRolesPage() {
  await requireRolePage(['admin', 'super_admin'])

  const users = await listUserRoles()
  const assignedCount = users.filter((u) => u.role !== null).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Roles</h1>
        <p className="mt-1 text-ink-muted">
          Allocate roles to new joiners and adjust existing ones. Admins can set
          any role except Super Admin; Super Admin accounts are managed by a
          Super Admin and appear locked here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User roster</CardTitle>
          <CardDescription>
            {users.length} user{users.length === 1 ? '' : 's'} ·{' '}
            {assignedCount} with a role
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-ink-muted">
              No users yet. People appear here once they have signed in at least
              once.
            </p>
          ) : (
            <RoleRoster users={users} callerIsSuperAdmin={false} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
