'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/super-admin/access-codes/_lib/actions.ts — access-code lifecycle
// (doc/update.md §3-4). SUPER ADMIN EXCLUSIVE — not shared with plain admin,
// per the doc's literal wording ("The Super Admin dashboard must include an
// interface to generate, assign, and revoke these access codes").
//
// SECURITY (Next.js 16): a Server Action is reachable by a DIRECT POST, so
// EVERY action here re-verifies requireRole(['super_admin']) internally.
//
// generateAccessCode creates a real auth.users row (synthetic email, code as
// password) via the GoTrue Admin API, then the role + profile/alias rows via
// the same path the existing role-roster flow uses (lib/dal/provisioning.ts).
// Any failure after the auth user exists is unwound with a single
// admin.auth.admin.deleteUser() call — every profile table FKs to
// auth.users(id) on delete cascade, so nothing is left dangling.
//
// revokeAccessCode is defense-in-depth: it flips access_codes.status AND
// rotates the Supabase-side password (+ bans the account), so a revoked code
// fails even via a hypothetical direct signInWithPassword call that bypasses
// the access_codes lookup entirely.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, writeAudit } from '@/lib/dal'
import { provisionIdentity } from '@/lib/dal/provisioning'
import {
  generateSyntheticEmail,
  generateAccessCodeValue,
} from '@/lib/auth/access-code-gen'
import { hashAccessCode } from '@/lib/auth/code-hash'
import type { Role } from '@/types/database'

export interface ActionResult {
  ok: boolean
  error: string | null
}

/** Max length we accept for a display name at code-generation time. */
const MAX_REAL_NAME = 120

type AdminClient = ReturnType<typeof createAdminClient>

// super_admin is never code-issuable — that role keeps email+password
// (doc/update.md §2), issued directly in Supabase, not through this UI.
const ISSUABLE_ROLES: readonly Role[] = [
  'admin',
  'coordinator',
  'mentor',
  'learner',
]

function isIssuableRole(v: string): v is Role {
  return (ISSUABLE_ROLES as readonly string[]).includes(v)
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name)
  return typeof v === 'string' ? v.trim() : ''
}

/** True when a GoTrue admin.createUser error is a synthetic-email collision. */
function isEmailCollision(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === 'email_exists' ||
    /already.*registered/i.test(error.message ?? '')
  )
}

/**
 * Assign the role + (for mentor/learner) provision the profile/alias, then
 * record the access_codes row. Returns an error without touching auth.users —
 * the caller deletes the just-created auth user on any failure here.
 */
async function finishProvisioning(args: {
  admin: AdminClient
  userId: string
  role: Role
  displayName: string
  schoolId: string | null
  syntheticEmail: string
  code: string
  createdBy: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { admin, userId, role, displayName, schoolId, syntheticEmail, code, createdBy } =
    args
  const scopedSchoolId = role === 'coordinator' ? schoolId : null

  const { error: roleErr } = await admin.from('user_roles').upsert(
    { user_id: userId, role, school_id: scopedSchoolId },
    { onConflict: 'user_id' }
  )
  if (roleErr) return { ok: false, error: 'Could not assign the role.' }

  if (role === 'mentor' || role === 'learner') {
    const provisioned = await provisionIdentity(admin, role, userId, displayName)
    if (!provisioned.ok) return provisioned
  }

  const { error: codeErr } = await admin.from('access_codes').insert({
    user_id: userId,
    role,
    display_name: displayName,
    school_id: scopedSchoolId,
    code_hash: hashAccessCode(code),
    synthetic_email: syntheticEmail,
    created_by: createdBy,
  })
  if (codeErr) return { ok: false, error: 'Could not save the access code.' }

  return { ok: true }
}

/**
 * Generate a brand-new access code for a role. Returns the PLAINTEXT code
 * exactly once — the caller (the show-once dialog) must display it immediately
 * and never refetch it; only a one-way hash is stored.
 */
export async function generateAccessCode(
  formData: FormData
): Promise<
  { ok: true; code: string; userId: string } | { ok: false; error: string }
> {
  const session = await requireRole(['super_admin'])

  const roleRaw = str(formData, 'role')
  const displayName = str(formData, 'displayName').slice(0, MAX_REAL_NAME)
  const schoolId = str(formData, 'schoolId') || null

  if (!isIssuableRole(roleRaw)) {
    return { ok: false, error: 'Choose a valid role.' }
  }
  if (!displayName) {
    return { ok: false, error: "Enter the person's name." }
  }
  const role = roleRaw

  const admin = createAdminClient()

  for (let attempt = 0; attempt < 6; attempt++) {
    const syntheticEmail = generateSyntheticEmail(role, attempt)
    const code = generateAccessCodeValue()

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      password: code,
      email_confirm: true,
      user_metadata: { access_code: true },
    })
    if (createErr || !created.user) {
      if (isEmailCollision(createErr) && attempt < 5) continue
      return { ok: false, error: 'Could not create the account. Please retry.' }
    }
    const userId = created.user.id

    const finished = await finishProvisioning({
      admin,
      userId,
      role,
      displayName,
      schoolId,
      syntheticEmail,
      code,
      createdBy: session.userId,
    })
    if (!finished.ok) {
      await admin.auth.admin.deleteUser(userId)
      return finished
    }

    await writeAudit({
      action: 'access_code.generate',
      entityType: 'access_codes',
      entityId: userId,
      metadata: { role, displayName },
    })
    revalidatePath('/super-admin/access-codes')
    revalidatePath('/admin/roles')
    revalidatePath('/super-admin/roles')
    return { ok: true, code, userId }
  }

  return { ok: false, error: 'Could not allocate a unique access code. Please retry.' }
}

/**
 * Revoke an access code: flip its status AND rotate the Supabase-side
 * password + ban the account, so the old code fails even via a direct
 * signInWithPassword call that skips the access_codes lookup entirely.
 *
 * Note: GoTrue enforces a ban on the account's next token refresh, not
 * instantly on an already-issued JWT — bounded by the access-token TTL.
 */
export async function revokeAccessCode(codeId: string): Promise<ActionResult> {
  const session = await requireRole(['super_admin'])
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('access_codes')
    .select('user_id, status')
    .eq('id', codeId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Access code not found.' }
  const { user_id: userId, status } = row as { user_id: string; status: string }
  if (status === 'revoked') return { ok: true, error: null }

  // Discarded immediately — never stored, never returned. Its only purpose is
  // to make the OLD code (the account's current password) stop working.
  const discardedPassword = generateAccessCodeValue()
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    password: discardedPassword,
    ban_duration: '876000h',
  })
  if (banErr) return { ok: false, error: 'Could not revoke the access code.' }

  const { error: flagErr } = await admin
    .from('access_codes')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: session.userId,
    })
    .eq('id', codeId)
  if (flagErr) return { ok: false, error: 'Could not revoke the access code.' }

  await writeAudit({
    action: 'access_code.revoke',
    entityType: 'access_codes',
    entityId: userId,
  })
  revalidatePath('/super-admin/access-codes')
  return { ok: true, error: null }
}

/**
 * The "lost code" recovery path: issues a NEW code for the SAME user/role/
 * profile (nothing is re-provisioned) and un-bans the account if it was
 * previously revoked. Returns the new plaintext code exactly once.
 */
export async function regenerateAccessCode(
  codeId: string
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const session = await requireRole(['super_admin'])
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('access_codes')
    .select('user_id')
    .eq('id', codeId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Access code not found.' }
  const { user_id: userId } = row as { user_id: string }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateAccessCodeValue()
    const codeHash = hashAccessCode(code)

    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
      password: code,
      ban_duration: 'none',
    })
    if (pwErr) return { ok: false, error: 'Could not regenerate the access code.' }

    const { error: updateErr } = await admin
      .from('access_codes')
      .update({
        code_hash: codeHash,
        status: 'active',
        revoked_at: null,
        revoked_by: null,
      })
      .eq('id', codeId)
    if (!updateErr) {
      await writeAudit({
        action: 'access_code.regenerate',
        entityType: 'access_codes',
        entityId: userId,
        metadata: { by: session.userId },
      })
      revalidatePath('/super-admin/access-codes')
      return { ok: true, code }
    }
    // 23505 = unique_violation (code_hash clash) — try a fresh code.
    if ((updateErr as { code?: string }).code === '23505' && attempt < 5) continue
    return { ok: false, error: 'Could not save the new access code.' }
  }

  return { ok: false, error: 'Could not allocate a unique access code. Please retry.' }
}
