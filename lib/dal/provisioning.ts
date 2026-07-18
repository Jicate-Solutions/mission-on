import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/dal/provisioning.ts — mentor/learner identity provisioning (profile +
// alias), shared by both the role-roster flow (app/api/roles/_lib/actions.ts)
// and the access-code generation flow
// (app/(app)/super-admin/access-codes/_lib/actions.ts). Extracted so there is
// exactly one place that calls the 0010 RPCs.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin'
import { generateAlias, type AliasKind } from '@/lib/dal/alias'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Provision a mentor/learner's identity (profile + alias) atomically via the
 * 0010 RPC. Idempotent: re-running for an already-provisioned user reuses the
 * existing alias. Retries on a UNIQUE alias clash (Postgres 23505) with a fresh
 * candidate. Returns the assigned alias or an error.
 */
export async function provisionIdentity(
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
