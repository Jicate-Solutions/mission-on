import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/dal/mentors.ts — Mentor reads, identity-split enforced.
//
// !!! DO NOT EVER JOIN mentor_profiles FROM THE PUBLIC FUNCTIONS !!!
// getMentorPublicList() and getMentorPublic() return ALIAS-ONLY data sourced
// EXCLUSIVELY from mentor_public. A Learner reaches mentors only through these.
// They must NEVER select from, join to, or otherwise touch mentor_profiles —
// real_name / phone / college / course must be UNREACHABLE down any path a
// Learner can call. The returned TS type (MentorPublic) has no real fields, so
// even a careless caller cannot read them; this comment guards the SOURCE side.
//
// getMentorFull() is the ONLY function that reads mentor_profiles, and it is
// guarded by requireRole(['admin','super_admin']) which throws on anyone else.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole, requireSession } from '@/lib/dal/session'
import type {
  MentorFull,
  MentorProfileRow,
  MentorPublic,
  MentorPublicRow,
} from '@/types/database'

function toMentorPublic(row: Pick<MentorPublicRow, 'id' | 'alias' | 'is_active'>): MentorPublic {
  return { id: row.id, alias: row.alias, is_active: row.is_active }
}

/**
 * List active mentors as ALIAS-ONLY DTOs (what a Learner browses). Any
 * authenticated user may call this. Queries mentor_public ONLY.
 *
 * @param opts.includeInactive admin/coordinator UIs may want inactive aliases;
 *   default false (learners must only see active mentors to choose).
 */
export async function getMentorPublicList(opts?: {
  includeInactive?: boolean
}): Promise<MentorPublic[]> {
  // Re-verify auth internally (defense against direct invocation).
  await requireSession()

  const supabase = await createClient()
  let query = supabase
    .from('mentor_public')
    // ALIAS-ONLY columns. NEVER add a mentor_profiles join here.
    .select('id, alias, is_active')
    .order('alias', { ascending: true })

  if (!opts?.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toMentorPublic)
}

/**
 * Fetch a single mentor as an ALIAS-ONLY DTO by mentor_public.id. Any
 * authenticated user may call this. Queries mentor_public ONLY. Returns null if
 * not found / not visible under RLS.
 */
export async function getMentorPublic(
  mentorPublicId: string
): Promise<MentorPublic | null> {
  await requireSession()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_public')
    // ALIAS-ONLY columns. NEVER add a mentor_profiles join here.
    .select('id, alias, is_active')
    .eq('id', mentorPublicId)
    .maybeSingle()

  if (error) throw error
  return data ? toMentorPublic(data) : null
}

/**
 * Fetch a mentor's FULL real identity by mentor_public.id.
 *
 * GUARDED: admin / super_admin only (requireRole throws AuthorizationError for
 * anyone else). This is the ONLY function in this module that reads
 * mentor_profiles. RLS on mentor_profiles is the backstop, but this app-layer
 * guard is the primary gate.
 *
 * Returns null if no such mentor exists.
 */
export async function getMentorFull(
  mentorPublicId: string
): Promise<MentorFull | null> {
  // Primary authorization gate — throws 403 for non-admins.
  await requireRole(['admin', 'super_admin'])

  const supabase = await createClient()
  // Read the alias row, then join through to the real profile. Only admins
  // reach this code, and RLS on mentor_profiles backstops the join.
  const { data, error } = await supabase
    .from('mentor_public')
    .select(
      'id, mentor_profile_id, alias, is_active, mentor_profiles!inner(id, user_id, real_name, phone, college, course)'
    )
    .eq('id', mentorPublicId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  // Supabase types the embedded relation as an array OR object depending on
  // inference; normalize defensively.
  const profileRel = (data as unknown as {
    mentor_profiles: MentorProfileRow | MentorProfileRow[]
  }).mentor_profiles
  const profile = Array.isArray(profileRel) ? profileRel[0] : profileRel
  if (!profile) return null

  return {
    id: data.id,
    profileId: profile.id,
    userId: profile.user_id,
    alias: data.alias,
    isActive: data.is_active,
    realName: profile.real_name,
    phone: profile.phone,
    college: profile.college,
    course: profile.course,
  }
}

/**
 * Fetch the FULL profile for the calling mentor themselves (self-view). A mentor
 * may always see their own real profile (RLS allows user_id = auth.uid()). Does
 * NOT require admin. Returns null if the caller has no mentor profile.
 */
export async function getOwnMentorFull(): Promise<MentorFull | null> {
  const session = await requireSession()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_profiles')
    .select(
      'id, user_id, real_name, phone, college, course, mentor_public!inner(id, alias, is_active)'
    )
    .eq('user_id', session.userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const publicRel = (data as unknown as {
    mentor_public: MentorPublicRow | MentorPublicRow[]
  }).mentor_public
  const pub = Array.isArray(publicRel) ? publicRel[0] : publicRel

  return {
    id: pub?.id ?? '',
    profileId: data.id,
    userId: data.user_id,
    alias: pub?.alias ?? '',
    isActive: pub?.is_active ?? false,
    realName: data.real_name,
    phone: data.phone,
    college: data.college,
    course: data.course,
  }
}
