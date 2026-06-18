import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/sessions/_data.ts — Server-only read for the learner's
// own awareness / follow-through sessions (PRD §9.5).
//
// SAFEGUARDING (read before editing):
//   A learner is shown ONLY logistics for sessions at THEIR OWN school: grade,
//   date, day, time and lifecycle status. The session's module_code lives in the
//   admin-only `session_design` child table (0006) and is NEVER selected here —
//   the SafeLearnerSessionRow allow-list cannot carry it. No real identity is
//   touched: we resolve the learner's own school_id from their own
//   learner_profiles row (RLS learner_profiles_self self-read), reading ONLY
//   school_id — never real_name / contact_number.
//
//   The `sessions` table has no learner SELECT RLS policy (it is staff-scoped),
//   so the RLS SSR client would return nothing for a learner. We therefore use
//   the service-role admin client for the sessions read ONLY, and we hard-scope
//   it to the learner's own school_id with an explicit safe-column allow-list.
//   This read is role-guarded (requireRole(['learner'])) and exposes strictly
//   the logistics DTO below — never a module code, never another school's data.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/dal'
import type { SessionStatus } from '@/types/database'

/** A session as the learner sees it: pure logistics. NO module_code, by design. */
export interface LearnerSessionRow {
  id: string
  grade: string
  sessionDate: string | null
  dayOfWeek: string | null
  startTime: string | null
  status: SessionStatus
}

// Explicit safe-column allow-list. module_code is not a column on `sessions`
// (it lives on the admin-only session_design child) and is never added here.
const SAFE_SESSION_COLUMNS =
  'id, grade, session_date, day_of_week, start_time, status'

interface SafeLearnerSessionRow {
  id: string
  grade: string
  session_date: string | null
  day_of_week: string | null
  start_time: string | null
  status: SessionStatus
}

/**
 * The school_id the calling learner belongs to (from their OWN learner_profiles
 * row, read under RLS — self only). Returns null when the learner has no profile
 * or no school yet. Selects ONLY school_id — never real-identity columns.
 */
async function getOwnSchoolId(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_profiles')
    .select('school_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return (data?.school_id as string | null) ?? null
}

/**
 * The calling learner's sessions: logistics-only rows for their own school,
 * soonest first. Returns an empty list when the learner has no school yet.
 */
export async function getOwnSchoolSessions(): Promise<LearnerSessionRow[]> {
  const session = await requireRole(['learner'])

  const schoolId = await getOwnSchoolId(session.userId)
  if (!schoolId) return []

  // sessions has no learner RLS policy → read via the service-role client, but
  // hard-scoped to the learner's own school and projecting only safe logistics.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sessions')
    .select(SAFE_SESSION_COLUMNS)
    .eq('school_id', schoolId)
    .order('session_date', { ascending: true, nullsFirst: false })

  if (error) throw error

  return ((data ?? []) as SafeLearnerSessionRow[]).map((r) => ({
    id: r.id,
    grade: r.grade,
    sessionDate: r.session_date,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    status: r.status,
  }))
}
