import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Role } from '@/types/database'

import type { UserRoleDto } from '@/app/api/roles/_lib/queries'
import { roleLabel } from './labels'
import { RoleSelectRow } from './role-select-row'

/**
 * Shared roster table for the role-management surface. Renders every auth user
 * with their current role and an inline role control. It is a Server Component
 * (no client state of its own) — only the per-row <RoleSelectRow> is a Client
 * Component.
 *
 * `callerIsSuperAdmin` drives what each row may do, mirroring the user_roles
 * RLS:
 *   - super_admin: may grant any role (incl. super_admin) to anyone.
 *   - admin: may grant any role EXCEPT super_admin, and may NOT modify a user
 *     who is currently super_admin (that row is locked).
 */
const ALL_ROLES: readonly Role[] = [
  'super_admin',
  'admin',
  'coordinator',
  'mentor',
  'learner',
]
const ADMIN_ASSIGNABLE: readonly Role[] = ALL_ROLES.filter(
  (r) => r !== 'super_admin'
)

function roleBadgeVariant(
  role: Role | null
): 'success' | 'info' | 'neutral' | 'warning' {
  switch (role) {
    case 'super_admin':
      return 'warning'
    case 'admin':
      return 'info'
    case null:
      return 'neutral'
    default:
      return 'success'
  }
}

export function RoleRoster({
  users,
  callerIsSuperAdmin,
}: {
  users: UserRoleDto[]
  callerIsSuperAdmin: boolean
}) {
  const assignableRoles = callerIsSuperAdmin ? ALL_ROLES : ADMIN_ASSIGNABLE

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Current role</TableHead>
          <TableHead className="text-right">Assign role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => {
          // An admin cannot touch a super_admin row.
          const locked = !callerIsSuperAdmin && u.role === 'super_admin'
          return (
            <TableRow key={u.userId}>
              <TableCell className="font-medium text-ink">
                {u.isCodeProvisioned ? (
                  u.displayName
                ) : (
                  u.email ?? (
                    <span className="text-ink-muted">
                      {u.userId.slice(0, 8)}… (no email)
                    </span>
                  )
                )}
              </TableCell>
              <TableCell>
                <Badge variant={roleBadgeVariant(u.role)}>
                  {roleLabel(u.role)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <RoleSelectRow
                  userId={u.userId}
                  currentRole={u.role}
                  subRole={u.subRole}
                  assignableRoles={assignableRoles}
                  locked={locked}
                  allowRevoke={callerIsSuperAdmin || u.role !== 'super_admin'}
                />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
