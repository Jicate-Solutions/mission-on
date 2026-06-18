import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/api/roles/_lib/queries.ts
//
// Role-management server-only data layer. OWNED by the role-management feature
// (lives under app/api/roles, one of the four paths this module owns). It
// re-verifies role on EVERY query and returns allow-listed DTOs only.
//
// LISTING USERS:
//   user_roles maps to auth.users, but the roster page must show EVERY auth user
//   — including joiners who have no role row yet. auth.users is not exposed via
//   the RLS-scoped SSR client, so we read it through the SERVICE-ROLE admin
//   client (lib/supabase/admin.ts). That client BYPASSES RLS, so this module is
//   the authorization boundary: every function calls requireRole(['admin',
//   'super_admin']) BEFORE touching the service-role client.
//
// We return only {userId, email, role|null, createdAt} — never tokens, password
// hashes, or other auth internals.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/dal'
import type { Role } from '@/types/database'

/** One row of the role roster: an auth user + their current role (if any). */
export interface UserRoleDto {
  userId: string
  email: string | null
  role: Role | null
  /** Sub-role flag — currently only 'jkkn_counsellor' (safeguarding lead). */
  subRole: string | null
  createdAt: string
}

/**
 * List every auth user joined to their current role. Admin/super_admin only.
 *
 * The auth user list comes from the service-role admin API (auth.users is not
 * readable via the SSR/anon client). Roles come from user_roles, which we read
 * with the same service-role client so the join is complete and order-stable
 * regardless of RLS. The requireRole above is the real gate.
 */
export async function listUserRoles(): Promise<UserRoleDto[]> {
  await requireRole(['admin', 'super_admin'])

  const admin = createAdminClient()

  // 1) Current roles + sub-roles, keyed by user id.
  const { data: roleRows, error: roleErr } = await admin
    .from('user_roles')
    .select('user_id, role, sub_role')
  if (roleErr) throw roleErr

  const roleByUser = new Map<string, Role>()
  const subRoleByUser = new Map<string, string | null>()
  for (const r of (roleRows ?? []) as {
    user_id: string
    role: Role
    sub_role: string | null
  }[]) {
    roleByUser.set(r.user_id, r.role)
    subRoleByUser.set(r.user_id, r.sub_role)
  }

  // 2) Auth users (paginate defensively; the joiner set is operationally small
  //    but listUsers caps each page, so walk pages until exhausted).
  const users: UserRoleDto[] = []
  const perPage = 1000
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const batch = data?.users ?? []
    for (const u of batch) {
      users.push({
        userId: u.id,
        email: u.email ?? null,
        role: roleByUser.get(u.id) ?? null,
        subRole: subRoleByUser.get(u.id) ?? null,
        createdAt: u.created_at,
      })
    }

    if (batch.length < perPage) break
    page += 1
  }

  // Stable, human-friendly ordering: assigned roles first is not meaningful, so
  // sort by email (nulls last) for a predictable roster.
  users.sort((a, b) => {
    if (a.email && b.email) return a.email.localeCompare(b.email)
    if (a.email) return -1
    if (b.email) return 1
    return a.userId.localeCompare(b.userId)
  })

  return users
}
