import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/super-admin/access-codes/_lib/queries.ts
//
// Access-code roster read path. SUPER ADMIN EXCLUSIVE (mirrors the actions in
// this same feature folder). Reads via the service-role client (access_codes'
// only RLS policy is super_admin-write, and we want a stable listing regardless
// of RLS timing) — requireRole is the real authorization boundary.
//
// Never selects synthetic_email or code_hash into the DTO: the synthetic email
// is a private Supabase Auth implementation detail and must never reach any
// client, and the hash has no legitimate use outside the sign-in lookup itself.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/dal'
import type { Role } from '@/types/database'

export interface AccessCodeDto {
  id: string
  role: Role
  displayName: string
  schoolId: string | null
  status: 'active' | 'revoked'
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}

/** List every issued access code, newest first. Super Admin only. */
export async function listAccessCodes(): Promise<AccessCodeDto[]> {
  await requireRole(['super_admin'])

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('access_codes')
    .select(
      'id, role, display_name, school_id, status, created_at, revoked_at, last_used_at'
    )
    .order('created_at', { ascending: false })
  if (error) throw error

  return (
    data as {
      id: string
      role: Role
      display_name: string
      school_id: string | null
      status: 'active' | 'revoked'
      created_at: string
      revoked_at: string | null
      last_used_at: string | null
    }[]
  ).map((r) => ({
    id: r.id,
    role: r.role,
    displayName: r.display_name,
    schoolId: r.school_id,
    status: r.status,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
    lastUsedAt: r.last_used_at,
  }))
}
