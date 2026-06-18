'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/api/roles/_lib/actions.ts — Role-allocation Server Actions.
//
// SECURITY (Next.js 16): a Server Action is reachable by a DIRECT POST, so a
// page-level gate does NOT protect it. EVERY action here re-verifies
// requireRole(['admin','super_admin']) internally before mutating.
//
// We MIRROR the user_roles RLS so the UI fails fast with a clear message rather
// than surfacing a raw RLS denial:
//   * super_admin may set ANY role on ANY user.
//   * admin may set NON super_admin roles only, and may NOT modify a user who is
//     CURRENTLY super_admin (no elevation, no demotion of a super_admin).
// RLS (user_roles_admin_* / user_roles_super_admin_write) is the backstop; this
// check is the primary app-layer gate.
//
// We write via the SERVICE-ROLE admin client because the roster spans every auth
// user (the SSR/anon client cannot read auth.users and the admin RLS predicates
// rely on current_user_role() which is fine — but to keep one consistent path we
// enforce the policy here in code and use the service role for the write). The
// requireRole + explicit elevation check above is the authorization boundary.
//
// Role changes are an AUDITED category (PRD §13). We write a role.assign /
// role.change / role.revoke audit entry on success.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, writeAudit } from '@/lib/dal'
import { generateAlias, type AliasKind } from '@/lib/dal/alias'
import type { Role } from '@/types/database'

export interface ActionResult {
  ok: boolean
  error: string | null
}

/** Max length we accept for a real name at provisioning time. */
const MAX_REAL_NAME = 120

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Provision a mentor/learner's identity (profile + alias) atomically via the
 * 0010 RPC. Idempotent: re-running for an already-provisioned user reuses the
 * existing alias. Retries on a UNIQUE alias clash (Postgres 23505) with a fresh
 * candidate. Returns the assigned alias or an error.
 */
async function provisionIdentity(
  admin: AdminClient,
  kind: AliasKind,
  userId: string,
  realName: string
): Promise<{ ok: true; alias: string } | { ok: false; error: string }> {
  const rpc =
    kind === 'mentor'
      ? 'provision_mentor_identity'
      : 'provision_learner_identity'

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await admin.rpc(rpc, {
      p_user_id: userId,
      p_real_name: realName,
      p_alias: generateAlias(kind, attempt),
    })
    if (!error) return { ok: true, alias: data as string }
    // 23505 = unique_violation (alias clash) — try a fresh alias.
    if (error.code === '23505' && attempt < 5) continue
    return { ok: false, error: 'Could not create the profile. Please retry.' }
  }
  return { ok: false, error: 'Could not allocate a unique alias. Please retry.' }
}

/** Deactivate a mentor's public alias so learners can no longer select them. */
async function deactivateMentorAlias(
  admin: AdminClient,
  userId: string
): Promise<void> {
  const { data: profile } = await admin
    .from('mentor_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!profile) return
  await admin
    .from('mentor_public')
    .update({ is_active: false })
    .eq('mentor_profile_id', (profile as { id: string }).id)
}

const ASSIGNABLE_ROLES: readonly Role[] = [
  'super_admin',
  'admin',
  'coordinator',
  'mentor',
  'learner',
]

function isRole(v: string): v is Role {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(v)
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Designate (or clear) a user as the JKKN safeguarding counsellor by setting
 * user_roles.sub_role = 'jkkn_counsellor'. This is the lead the safeguarding
 * router prefers (resolveSafeguardingRecipients). Admin/super_admin only; an
 * admin may not modify a super_admin row (mirrors the role-allocation rule). The
 * target must already have a role (sub_role lives on the user_roles row).
 */
export async function setUserSubRole(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(['admin', 'super_admin'])
  const callerIsSuperAdmin = session.role === 'super_admin'

  const targetUserId = str(formData, 'userId')
  const isCounsellor = str(formData, 'isCounsellor') === 'true'
  if (!targetUserId) return { ok: false, error: 'Missing user.' }

  const admin = createAdminClient()
  const { data: existing, error: lookupErr } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', targetUserId)
    .maybeSingle()
  if (lookupErr) return { ok: false, error: 'Could not read current role.' }

  const currentRole = (existing?.role as Role | undefined) ?? null
  if (currentRole === null) {
    return { ok: false, error: 'Assign a role before designating a counsellor.' }
  }
  if (!callerIsSuperAdmin && currentRole === 'super_admin') {
    return { ok: false, error: 'Only a Super Admin can modify a Super Admin.' }
  }

  const { error } = await admin
    .from('user_roles')
    .update({
      sub_role: isCounsellor ? 'jkkn_counsellor' : null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', targetUserId)
  if (error) {
    return { ok: false, error: 'Could not update the counsellor designation.' }
  }

  await writeAudit({
    action: 'counsellor.designate',
    entityType: 'user_roles',
    entityId: targetUserId,
    metadata: { isCounsellor },
  })

  revalidatePath('/admin/roles')
  revalidatePath('/super-admin/roles')
  return { ok: true, error: null }
}

/**
 * Assign or change a user's role. The new role may be empty ('') to REVOKE the
 * role (delete the user_roles row).
 *
 * Authorization (mirrors RLS):
 *   - caller must be admin or super_admin (requireRole)
 *   - an admin may NOT set super_admin, and may NOT modify a user who is
 *     currently super_admin
 */
export async function setUserRole(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(['admin', 'super_admin'])
  const callerIsSuperAdmin = session.role === 'super_admin'

  const targetUserId = str(formData, 'userId')
  const nextRoleRaw = str(formData, 'role')
  const realName = str(formData, 'realName').slice(0, MAX_REAL_NAME)
  if (!targetUserId) {
    return { ok: false, error: 'Missing user.' }
  }

  // Empty string means "revoke role". Otherwise it must be a known role.
  if (nextRoleRaw !== '' && !isRole(nextRoleRaw)) {
    return { ok: false, error: 'Unknown role.' }
  }
  const nextRole: Role | null = nextRoleRaw === '' ? null : nextRoleRaw

  const admin = createAdminClient()

  // Look up the target's CURRENT role to enforce the admin restrictions and to
  // pick the right audit action.
  const { data: existing, error: lookupErr } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', targetUserId)
    .maybeSingle()
  if (lookupErr) {
    return { ok: false, error: 'Could not read current role.' }
  }
  const currentRole = (existing?.role as Role | undefined) ?? null

  // Admin restrictions (mirror RLS): cannot grant super_admin, cannot touch an
  // existing super_admin row.
  if (!callerIsSuperAdmin) {
    if (nextRole === 'super_admin') {
      return {
        ok: false,
        error: 'Only a Super Admin can grant the Super Admin role.',
      }
    }
    if (currentRole === 'super_admin') {
      return {
        ok: false,
        error: 'Only a Super Admin can modify a Super Admin.',
      }
    }
  }

  // No-op guard: setting the same role (or revoking an already-absent role).
  if (currentRole === nextRole) {
    return { ok: true, error: null }
  }

  // Provisioning precheck: assigning mentor/learner creates their identity rows.
  // A real name is required ONLY when no profile exists for them yet.
  if (nextRole === 'mentor' || nextRole === 'learner') {
    const profileTable =
      nextRole === 'mentor' ? 'mentor_profiles' : 'learner_profiles'
    const { data: existingProfile } = await admin
      .from(profileTable)
      .select('id')
      .eq('user_id', targetUserId)
      .maybeSingle()
    if (!existingProfile && realName.length === 0) {
      return {
        ok: false,
        error: `Enter the person’s real name to create their ${nextRole} profile.`,
      }
    }
  }

  if (nextRole === null) {
    // Revoke: delete the row.
    const { error } = await admin
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId)
    if (error) {
      return { ok: false, error: 'Could not revoke role.' }
    }
    await writeAudit({
      action: 'role.revoke',
      entityType: 'user_roles',
      entityId: targetUserId,
      metadata: { previousRole: currentRole },
    })
    // A revoked mentor must no longer be selectable by learners.
    if (currentRole === 'mentor') {
      await deactivateMentorAlias(admin, targetUserId)
    }
  } else {
    // Assign or change: upsert on the user_id primary key. Clearing school_id /
    // sub_role on a role change is intentional — re-scoping (e.g. a coordinator
    // to a school) is a separate operation handled in the school feature.
    const { error } = await admin.from('user_roles').upsert(
      {
        user_id: targetUserId,
        role: nextRole,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (error) {
      return { ok: false, error: 'Could not save role.' }
    }
    await writeAudit({
      action: currentRole === null ? 'role.assign' : 'role.change',
      entityType: 'user_roles',
      entityId: targetUserId,
      metadata: { previousRole: currentRole, newRole: nextRole },
    })

    // Provision identity rows for mentor/learner so the rest of the app (mentor
    // browsing, selection, feedback, follow-through) has profile + alias to FK.
    if (nextRole === 'mentor' || nextRole === 'learner') {
      const provisioned = await provisionIdentity(
        admin,
        nextRole,
        targetUserId,
        realName
      )
      if (!provisioned.ok) {
        // The role is saved; surface the provisioning failure so the admin can
        // retry (provisioning is idempotent, so a retry is safe).
        return { ok: false, error: provisioned.error }
      }
      await writeAudit({
        action: `${nextRole}.provision`,
        entityType:
          nextRole === 'mentor' ? 'mentor_profiles' : 'learner_profiles',
        entityId: targetUserId,
        metadata: { alias: provisioned.alias },
      })
    }

    // Moving AWAY from mentor: retire their alias so learners can't pick them.
    if (currentRole === 'mentor' && nextRole !== 'mentor') {
      await deactivateMentorAlias(admin, targetUserId)
    }
  }

  // Revalidate both roster surfaces (only one is reachable per caller, but both
  // read the same data and the path-revalidate is cheap).
  revalidatePath('/admin/roles')
  revalidatePath('/super-admin/roles')
  return { ok: true, error: null }
}
