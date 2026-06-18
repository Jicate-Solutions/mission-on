import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// follow-through (mentor) — server-only data layer.
//
// Ring-1 confidential. Every function re-verifies the caller is the AUTHORING
// mentor; RLS on follow_through_logs / safeguarding_escalations is the backstop.
//
// Identity discipline: this module works with learner ALIASES for display. The
// only "real" value it touches is learner_profiles.id — an opaque uuid that is
// the FK target of follow_through_logs.learner_id. It NEVER selects real_name /
// contact_number. A mentor maps alias -> profile id only for learners actively
// assigned to them (RLS permits reading learner_public.learner_profile_id for
// those rows), so this never leaks identity of an unassigned learner.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type {
  FollowThroughLogRow,
  EscalationStatus,
} from '@/types/database'

/** One assigned learner, alias-first, with the opaque profile id used as FK. */
export interface AssignedLearner {
  /** learner_public.id (the alias-table id). */
  learnerPublicId: string
  /** learner_profiles.id — opaque FK target for follow_through_logs.learner_id. */
  learnerProfileId: string
  alias: string
}

/** A follow-through log as the authoring mentor sees it (alias-decorated). */
export interface MentorLog {
  id: string
  learnerProfileId: string
  /** Alias resolved for display (or a neutral fallback). */
  learnerAlias: string
  notes: string | null
  flags: string[]
  safeguardingEscalated: boolean
  /** Status of the latest escalation on this log, if any. */
  escalationStatus: EscalationStatus | null
  createdAt: string
  updatedAt: string
}

/**
 * Resolve the calling mentor's mentor_profiles.id (needed to write logs with the
 * correct mentor_id and to verify ownership). Returns null if the caller has no
 * mentor profile. Reads own row only (RLS scoped).
 */
export async function getOwnMentorProfileId(): Promise<string | null> {
  const session = await requireRole(['mentor'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_profiles')
    .select('id')
    .eq('user_id', session.userId)
    .maybeSingle<{ id: string }>()
  if (error) throw error
  return data?.id ?? null
}

/**
 * List the learners actively assigned to the calling mentor, alias-first, each
 * with the opaque learner_profiles.id used as the follow-through FK.
 *
 * Path: learner_mentor_assignments (own, active) -> learner_public (alias +
 * learner_profile_id). NEVER touches learner_profiles columns beyond the id.
 */
export async function getAssignedLearners(): Promise<AssignedLearner[]> {
  await requireRole(['mentor'])
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('learner_mentor_assignments')
    .select(
      'learner_public_id, status, learner_public!inner(id, alias, learner_profile_id)'
    )
    .eq('status', 'active')

  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    learner_public_id: string
    learner_public:
      | { id: string; alias: string; learner_profile_id: string }
      | { id: string; alias: string; learner_profile_id: string }[]
  }>

  const out: AssignedLearner[] = []
  for (const r of rows) {
    const lp = Array.isArray(r.learner_public)
      ? r.learner_public[0]
      : r.learner_public
    if (!lp) continue
    out.push({
      learnerPublicId: lp.id,
      learnerProfileId: lp.learner_profile_id,
      alias: lp.alias,
    })
  }
  // Stable alphabetical-by-alias ordering for the UI.
  out.sort((a, b) => a.alias.localeCompare(b.alias))
  return out
}

/**
 * List the calling mentor's own follow-through logs, newest first, decorated
 * with the learner alias and the latest escalation status. RLS guarantees only
 * the authoring mentor's rows return.
 */
export async function getOwnLogs(): Promise<MentorLog[]> {
  await requireRole(['mentor'])
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('follow_through_logs')
    .select(
      'id, learner_id, notes, flags, safeguarding_escalated, created_at, updated_at'
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  const logs = (data ?? []) as Array<
    Pick<
      FollowThroughLogRow,
      | 'id'
      | 'learner_id'
      | 'notes'
      | 'flags'
      | 'safeguarding_escalated'
      | 'created_at'
      | 'updated_at'
    >
  >

  if (logs.length === 0) return []

  // Resolve aliases for the referenced learners via the assignment-scoped
  // learner_public rows the mentor may read. Map profile id -> alias.
  const aliasByProfileId = await aliasMapForProfileIds(
    logs.map((l) => l.learner_id)
  )

  // Resolve the latest escalation status per log.
  const statusByLogId = await escalationStatusForLogs(logs.map((l) => l.id))

  return logs.map((l) => ({
    id: l.id,
    learnerProfileId: l.learner_id,
    learnerAlias: aliasByProfileId.get(l.learner_id) ?? 'Learner',
    notes: l.notes,
    flags: l.flags ?? [],
    safeguardingEscalated: l.safeguarding_escalated,
    escalationStatus: statusByLogId.get(l.id) ?? null,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  }))
}

/** Map learner_profiles.id -> alias for the learners this mentor may see. */
async function aliasMapForProfileIds(
  profileIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(profileIds)]
  if (unique.length === 0) return map

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_public')
    .select('alias, learner_profile_id')
    .in('learner_profile_id', unique)

  if (error) throw error
  for (const r of (data ?? []) as Array<{
    alias: string
    learner_profile_id: string
  }>) {
    map.set(r.learner_profile_id, r.alias)
  }
  return map
}

/** Map follow_through_log_id -> latest escalation status (own logs only). */
async function escalationStatusForLogs(
  logIds: string[]
): Promise<Map<string, EscalationStatus>> {
  const map = new Map<string, EscalationStatus>()
  if (logIds.length === 0) return map

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('safeguarding_escalations')
    .select('follow_through_log_id, status, created_at')
    .in('follow_through_log_id', logIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  for (const r of (data ?? []) as Array<{
    follow_through_log_id: string
    status: EscalationStatus
  }>) {
    // First row per log wins (ordered desc), i.e. the latest escalation.
    if (!map.has(r.follow_through_log_id)) {
      map.set(r.follow_through_log_id, r.status)
    }
  }
  return map
}
