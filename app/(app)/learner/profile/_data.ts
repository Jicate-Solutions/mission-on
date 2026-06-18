import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/profile/_data.ts — the calling learner's OWN profile
// (PRD §7.6, §9.5). Learner-only, self-scoped.
//
// SECURITY: re-verifies the learner role internally. Reads only the caller's own
// rows (RLS: learner_profiles_select/learner_public_select pin to user_id =
// auth.uid()). Real name + school are surfaced to the learner about THEMSELVES
// only — never about anyone else, and never to other roles via this path.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'

export interface LearnerProfileView {
  /** False until an admin has provisioned the learner's identity rows. */
  hasProfile: boolean
  alias: string | null
  realName: string | null
  contactNumber: string | null
  schoolName: string | null
}

const EMPTY: LearnerProfileView = {
  hasProfile: false,
  alias: null,
  realName: null,
  contactNumber: null,
  schoolName: null,
}

/**
 * The calling learner's own profile. Joins the alias (learner_public) and school
 * name (schools) via direct foreign keys. Returns hasProfile=false when no
 * profile exists yet.
 */
export async function getLearnerProfile(): Promise<LearnerProfileView> {
  const session = await requireRole(['learner'])
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('learner_profiles')
    .select(
      'real_name, contact_number, schools(name), learner_public(alias)'
    )
    .eq('user_id', session.userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return EMPTY

  const row = data as unknown as {
    real_name: string
    contact_number: string | null
    schools: { name: string } | { name: string }[] | null
    learner_public: { alias: string } | { alias: string }[] | null
  }
  const school = Array.isArray(row.schools) ? row.schools[0] : row.schools
  const pub = Array.isArray(row.learner_public)
    ? row.learner_public[0]
    : row.learner_public

  return {
    hasProfile: true,
    alias: pub?.alias ?? null,
    realName: row.real_name,
    contactNumber: row.contact_number,
    schoolName: school?.name ?? null,
  }
}
