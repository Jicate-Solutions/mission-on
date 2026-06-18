import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/mentor/modules/_data.ts — Read-only module/session reads for the
// Mentor's "My modules" view (PRD §7.4, §9.4).
//
// SAFEGUARDING (read before editing):
//   SELF-SCOPED and CLASSIFICATION-FREE. The mentor reads session_brief_v (0012),
//   a security-definer view that returns ONLY the sessions this mentor is on the
//   team for, with the delivery BRIEF (film/demo/framework/escalation/facilitator)
//   — and DELIBERATELY OMITS the module CODE (session_design.module_code), which
//   is classification and ADMIN/SUPER_ADMIN-ONLY by RBAC (PRD §11). The view's
//   own auth.uid() predicate does the scoping; we never query the admin-only
//   tables. Schools are name-only; no minor PII is read.
//
//   Re-verifies the mentor role internally (defense against direct invocation).
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole, getOwnMentorFull } from '@/lib/dal'
import type { SessionStatus } from '@/types/database'

/** The delivery brief a mentor sees for a session (no module code). */
export interface MentorBrief {
  mediaFilm: string | null
  demonstration: string | null
  conversationFramework: string | null
  escalationPathway: string | null
  learningFacilitator: string | null
  notes: string | null
}

/** One session the mentor will help deliver / follow through for. */
export interface MentorModuleSession {
  /** sessions.id */
  id: string
  schoolId: string
  schoolName: string
  grade: string
  sessionDate: string | null
  startTime: string | null
  status: SessionStatus
  /** The delivery plan brief (classification code excluded). */
  brief: MentorBrief
}

/** A school the mentor is allocated to, with its sessions. */
export interface MentorModuleSchool {
  schoolId: string
  schoolName: string
  sessions: MentorModuleSession[]
}

export interface MentorModulesView {
  /** Whether the mentor has a profile/alias yet. */
  hasProfile: boolean
  schools: MentorModuleSchool[]
}

interface SessionBriefRow {
  session_id: string
  school_id: string
  school_name: string
  grade: string
  session_date: string | null
  start_time: string | null
  status: SessionStatus
  media_film: string | null
  demonstration: string | null
  conversation_framework: string | null
  escalation_pathway: string | null
  learning_facilitator: string | null
  notes: string | null
}

/**
 * The sessions this mentor is on the team for, grouped by school, each with its
 * delivery brief. MENTOR ONLY (re-verified). Reads session_brief_v, which
 * self-scopes to the caller and excludes the module code. Returns an empty view
 * when the caller has no mentor profile yet.
 */
export async function getMentorModules(): Promise<MentorModulesView> {
  await requireRole(['mentor'])

  const me = await getOwnMentorFull()
  if (!me || !me.profileId) {
    return { hasProfile: false, schools: [] }
  }

  const supabase = await createClient()

  // The brief view self-scopes to the calling mentor (auth.uid()) and omits the
  // module code — no extra filter needed here.
  const { data, error } = await supabase
    .from('session_brief_v')
    .select(
      'session_id, school_id, school_name, grade, session_date, start_time, status, media_film, demonstration, conversation_framework, escalation_pathway, learning_facilitator, notes'
    )
    .order('session_date', { ascending: true, nullsFirst: false })

  if (error) throw error

  const schoolMap = new Map<string, MentorModuleSchool>()
  for (const r of (data ?? []) as SessionBriefRow[]) {
    let bucket = schoolMap.get(r.school_id)
    if (!bucket) {
      bucket = { schoolId: r.school_id, schoolName: r.school_name, sessions: [] }
      schoolMap.set(r.school_id, bucket)
    }
    bucket.sessions.push({
      id: r.session_id,
      schoolId: r.school_id,
      schoolName: r.school_name,
      grade: r.grade,
      sessionDate: r.session_date,
      startTime: r.start_time,
      status: r.status,
      brief: {
        mediaFilm: r.media_film,
        demonstration: r.demonstration,
        conversationFramework: r.conversation_framework,
        escalationPathway: r.escalation_pathway,
        learningFacilitator: r.learning_facilitator,
        notes: r.notes,
      },
    })
  }

  const schools = [...schoolMap.values()].sort((a, b) =>
    a.schoolName.localeCompare(b.schoolName)
  )

  return { hasProfile: true, schools }
}
