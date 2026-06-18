import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/dal/learners.ts — Learner reads, identity-split + reveal-gate enforced.
//
// Learner real identity is MINOR data — the highest sensitivity in this system.
//
// getLearnerPublic*()  -> ALIAS-ONLY, sourced EXCLUSIVELY from learner_public.
//   Never joins learner_profiles. The DTO (LearnerPublic) carries no real
//   fields, so a caller cannot read real_name even by accident.
//
// getLearnerFull(learnerProfileId) -> REAL identity from learner_profiles.
//   Authorized when EITHER:
//     (a) caller is admin / super_admin, OR
//     (b) caller is a mentor AND can_access_learner_identity(learnerProfileId)
//         returns true — i.e. an ACTIVE (open/acknowledged, NOT resolved)
//         safeguarding escalation links THIS mentor to THIS learner.
//   This is the "reveal-on-safeguarding" rule. RLS on learner_profiles is the
//   backstop; this app-layer gate is the primary check and also emits an
//   identity.reveal audit entry for any mentor reveal.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireSession, verifySession } from '@/lib/dal/session'
import { writeAudit } from '@/lib/dal/audit'
import { AuthorizationError } from '@/lib/dal/session'
import type {
  LearnerFull,
  LearnerProfileRow,
  LearnerPublic,
  LearnerPublicRow,
} from '@/types/database'

function toLearnerPublic(
  row: Pick<LearnerPublicRow, 'id' | 'alias'>
): LearnerPublic {
  return { id: row.id, alias: row.alias }
}

/**
 * Fetch a single learner as an ALIAS-ONLY DTO by learner_public.id. Queries
 * learner_public ONLY. RLS decides visibility. Returns null if not found.
 */
export async function getLearnerPublic(
  learnerPublicId: string
): Promise<LearnerPublic | null> {
  await requireSession()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_public')
    // ALIAS-ONLY columns. NEVER join learner_profiles here.
    .select('id, alias')
    .eq('id', learnerPublicId)
    .maybeSingle()

  if (error) throw error
  return data ? toLearnerPublic(data) : null
}

/**
 * List learners as ALIAS-ONLY DTOs (e.g. a mentor's assigned-learner list,
 * alias-first per PRD §9.4). Queries learner_public ONLY; RLS scopes which rows
 * are returned. Pass `learnerPublicIds` to restrict to a known set.
 */
export async function getLearnerPublicList(
  learnerPublicIds?: string[]
): Promise<LearnerPublic[]> {
  await requireSession()

  const supabase = await createClient()
  let query = supabase
    .from('learner_public')
    // ALIAS-ONLY columns. NEVER join learner_profiles here.
    .select('id, alias')
    .order('alias', { ascending: true })

  if (learnerPublicIds && learnerPublicIds.length > 0) {
    query = query.in('id', learnerPublicIds)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toLearnerPublic)
}

/**
 * Fetch a learner's FULL real identity (minor data) by learner_profiles.id.
 *
 * GUARDED. Authorized when:
 *   - caller is admin / super_admin (always), OR
 *   - caller is a mentor with an active safeguarding reveal for THIS learner
 *     (can_access_learner_identity, SECURITY DEFINER).
 * Any other caller -> AuthorizationError(403).
 *
 * A successful MENTOR reveal is audited (identity.reveal). Admin reads are not
 * audited here (admins have routine directory access); pass through writeAudit
 * separately if a specific admin read needs logging.
 *
 * Returns null if no such learner exists.
 */
export async function getLearnerFull(
  learnerProfileId: string
): Promise<LearnerFull | null> {
  const session = await verifySession()
  if (!session) throw new AuthorizationError('Not authenticated.', 401)

  const isAdmin = session.role === 'admin' || session.role === 'super_admin'
  let mentorRevealGranted = false

  if (!isAdmin) {
    if (session.role !== 'mentor') {
      throw new AuthorizationError(
        'Forbidden: learner identity is restricted.',
        403
      )
    }
    // Reveal gate: ask the SECURITY DEFINER function whether THIS mentor has an
    // active safeguarding escalation linking them to THIS learner.
    const supabaseGate = await createClient()
    const { data: canAccess, error: gateError } = await supabaseGate.rpc(
      'can_access_learner_identity',
      { learner: learnerProfileId }
    )
    if (gateError) throw gateError
    if (canAccess !== true) {
      throw new AuthorizationError(
        'Forbidden: no active safeguarding reveal for this learner.',
        403
      )
    }
    mentorRevealGranted = true
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_profiles')
    .select('id, user_id, real_name, contact_number, school_id')
    .eq('id', learnerProfileId)
    .maybeSingle<LearnerProfileRow>()

  if (error) throw error
  if (!data) return null

  // Audit any mentor reveal of a learner's real identity (PRD §13 safeguarding).
  if (mentorRevealGranted) {
    await writeAudit({
      action: 'identity.reveal',
      entityType: 'learner_profiles',
      entityId: data.id,
      actorId: session.userId,
      metadata: { via: 'safeguarding_reveal', role: session.role },
    })
  }

  return {
    id: data.id,
    userId: data.user_id,
    realName: data.real_name,
    contactNumber: data.contact_number,
    schoolId: data.school_id,
  }
}

/**
 * Fetch the FULL profile for the calling learner themselves (self-view). A
 * learner may always see their own real profile (RLS allows user_id =
 * auth.uid()). Returns null if the caller has no learner profile.
 */
export async function getOwnLearnerFull(): Promise<LearnerFull | null> {
  const session = await requireSession()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_profiles')
    .select('id, user_id, real_name, contact_number, school_id')
    .eq('user_id', session.userId)
    .maybeSingle<LearnerProfileRow>()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    userId: data.user_id,
    realName: data.real_name,
    contactNumber: data.contact_number,
    schoolId: data.school_id,
  }
}
