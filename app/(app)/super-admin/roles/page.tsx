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

export const metadata: Metadata = { title: 'Roles — Super Admin — Mission ON' }

// Per-user sensitive data (auth user list + roles): never cache.
export const dynamic = 'force-dynamic'

/**
 * Super Admin role management (PRD §7.1, §11, §SA). FULL control: a Super Admin
 * may grant ANY role to ANY user — including promoting/demoting Admins and other
 * Super Admins — which the admin surface cannot. No row is locked here.
 *
 * Gating: the super-admin route-group layout requires super_admin; this page
 * re-asserts it, and listUserRoles + setUserRole each re-verify role internally.
 */
export default async function SuperAdminRolesPage() {
  await requireRolePage(['super_admin'])

  const users = await listUserRoles()
  const adminCount = users.filter(
    (u) => u.role === 'admin' || u.role === 'super_admin'
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Roles</h1>
        <p className="mt-1 text-ink-muted">
          Full role management. Grant any role to any user, including managing
          Admins and other Super Admins. Every change is recorded in the audit
          log.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User roster</CardTitle>
          <CardDescription>
            {users.length} user{users.length === 1 ? '' : 's'} · {adminCount}{' '}
            admin / super admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-ink-muted">
              No users yet. People appear here once they have signed in at least
              once.
            </p>
          ) : (
            <RoleRoster users={users} callerIsSuperAdmin={true} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
