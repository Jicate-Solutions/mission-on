import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/modules/_lib/queries.ts — Admin/super_admin reads for the
// Module Design Workspace (PRD §7.4).
//
// SECURITY: every function re-verifies admin/super_admin via
// requireRole(['admin','super_admin']) BEFORE touching the DB — a page-level
// gate is never trusted. These reads surface admin-only data:
//   * questionnaire_classification.{confirmed,computed}_module_code (per school),
//   * session_design.module_code (the designed planning anchor).
// Both tables are RLS-locked to is_admin_role() (0006), so the SSR client only
// returns them to admins; this app-layer requireRole is the primary gate.
//
// Identity discipline: mentors are surfaced ALIAS-ONLY (mentor_public). Schools
// are name-only. No minor PII is ever read here.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type { ModuleCode, SessionStatus } from '@/types/database'

import type {
  AssignedMentor,
  DeliveryPlan,
  MentorOption,
  SchoolModuleSummary,
  SessionDesignDetail,
  WorkspaceSession,
} from './types'

const EMPTY_PLAN: DeliveryPlan = {
  mediaFilm: null,
  demonstration: null,
  conversationFramework: null,
  escalationPathway: null,
  learningFacilitator: null,
  notes: null,
}

const ADMIN_ROLES = ['admin', 'super_admin'] as const

/**
 * Build a school_id -> { confirmed, computed } module-code map from
 * questionnaire_classification (joined through questionnaire_responses for the
 * school_id). Admin-only embed. A school may have multiple responses; the most
 * recently updated confirmed/computed wins.
 */
async function moduleCodeBySchool(): Promise<
  Map<string, { confirmed: ModuleCode | null; computed: ModuleCode | null }>
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select(
      'school_id, updated_at, questionnaire_classification ( computed_module_code, confirmed_module_code )'
    )
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load module classifications: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as Array<{
    school_id: string
    questionnaire_classification:
      | {
          computed_module_code: ModuleCode | null
          confirmed_module_code: ModuleCode | null
        }
      | {
          computed_module_code: ModuleCode | null
          confirmed_module_code: ModuleCode | null
        }[]
      | null
  }>

  const map = new Map<
    string,
    { confirmed: ModuleCode | null; computed: ModuleCode | null }
  >()
  for (const r of rows) {
    if (map.has(r.school_id)) continue // first (newest) wins
    const c = Array.isArray(r.questionnaire_classification)
      ? r.questionnaire_classification[0]
      : r.questionnaire_classification
    map.set(r.school_id, {
      confirmed: c?.confirmed_module_code ?? null,
      computed: c?.computed_module_code ?? null,
    })
  }
  return map
}

/**
 * Map session_id -> designed module_code from the admin-only session_design
 * child table. Admin RLS scoped.
 */
async function designedModuleBySession(
  sessionIds: string[]
): Promise<Map<string, ModuleCode | null>> {
  const map = new Map<string, ModuleCode | null>()
  if (sessionIds.length === 0) return map

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('session_design')
    .select('session_id, module_code')
    .in('session_id', sessionIds)

  if (error) {
    throw new Error(`Failed to load session designs: ${error.message}`)
  }
  for (const r of (data ?? []) as Array<{
    session_id: string
    module_code: ModuleCode | null
  }>) {
    map.set(r.session_id, r.module_code)
  }
  return map
}

/**
 * List every session for the workspace, decorated with the school name, the
 * school's confirmed/computed module code, and the designed planning module
 * (if attached). Newest sessions first. ADMIN / SUPER_ADMIN ONLY.
 */
export async function listWorkspaceSessions(): Promise<WorkspaceSession[]> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, school_id, grade, session_date, start_time, status, created_at, schools!inner(name)'
    )
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load sessions: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string
    school_id: string
    grade: string
    session_date: string | null
    start_time: string | null
    status: SessionStatus
    schools: { name: string } | { name: string }[]
  }>

  const [moduleMap, designMap] = await Promise.all([
    moduleCodeBySchool(),
    designedModuleBySession(rows.map((r) => r.id)),
  ])

  return rows.map((r) => {
    const rel = r.schools
    const school = Array.isArray(rel) ? rel[0] : rel
    const mod = moduleMap.get(r.school_id)
    return {
      id: r.id,
      schoolId: r.school_id,
      schoolName: school?.name ?? '(unknown school)',
      grade: r.grade,
      sessionDate: r.session_date,
      startTime: r.start_time,
      status: r.status,
      confirmedModuleCode: mod?.confirmed ?? null,
      computedModuleCode: mod?.computed ?? null,
      designedModuleCode: designMap.get(r.id) ?? null,
    }
  })
}

/**
 * Schools grouped with their confirmed/computed module code, for the workspace
 * index overview. ADMIN / SUPER_ADMIN ONLY.
 */
export async function listSchoolModuleSummaries(): Promise<
  SchoolModuleSummary[]
> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to load schools: ${error.message}`)
  }

  const moduleMap = await moduleCodeBySchool()

  return (data ?? []).map((s) => {
    const mod = moduleMap.get(s.id)
    return {
      schoolId: s.id,
      schoolName: s.name,
      confirmedModuleCode: mod?.confirmed ?? null,
      computedModuleCode: mod?.computed ?? null,
    }
  })
}

/**
 * Read one session's full design row: the planning module code + the delivery
 * plan (brief). Admin RLS scoped. Returns nulls when no design row exists yet.
 */
async function getSessionDesignRow(
  sessionId: string
): Promise<{ moduleCode: ModuleCode | null; plan: DeliveryPlan }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('session_design')
    .select(
      'module_code, media_film, demonstration, conversation_framework, escalation_pathway, learning_facilitator, notes'
    )
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load session design: ${error.message}`)
  }
  if (!data) return { moduleCode: null, plan: EMPTY_PLAN }

  const r = data as {
    module_code: ModuleCode | null
    media_film: string | null
    demonstration: string | null
    conversation_framework: string | null
    escalation_pathway: string | null
    learning_facilitator: string | null
    notes: string | null
  }
  return {
    moduleCode: r.module_code,
    plan: {
      mediaFilm: r.media_film,
      demonstration: r.demonstration,
      conversationFramework: r.conversation_framework,
      escalationPathway: r.escalation_pathway,
      learningFacilitator: r.learning_facilitator,
      notes: r.notes,
    },
  }
}

/**
 * Mentors on a session's team, alias-only. Resolves session_mentors ->
 * mentor_public. ADMIN-gated (caller verifies).
 */
async function mentorsForSession(sessionId: string): Promise<AssignedMentor[]> {
  const supabase = await createClient()

  // Step 1: the team's mentor_profile_ids for this session.
  const { data: teamRows, error: teamErr } = await supabase
    .from('session_mentors')
    .select('mentor_profile_id')
    .eq('session_id', sessionId)
  if (teamErr) {
    throw new Error(`Failed to load session mentors: ${teamErr.message}`)
  }
  const profileIds = (teamRows ?? []).map(
    (r) => (r as { mentor_profile_id: string }).mentor_profile_id
  )
  if (profileIds.length === 0) return []

  // Step 2: resolve to alias rows (mentor_public). Explicit two-step avoids
  // relying on a PostgREST two-hop embed (session_mentors has no direct FK to
  // mentor_public — both reference mentor_profiles).
  const { data: aliasRows, error: aliasErr } = await supabase
    .from('mentor_public')
    .select('id, alias, is_active, mentor_profile_id')
    .in('mentor_profile_id', profileIds)
  if (aliasErr) {
    throw new Error(`Failed to load mentor aliases: ${aliasErr.message}`)
  }

  const out: AssignedMentor[] = (aliasRows ?? []).map((m) => {
    const r = m as { id: string; alias: string; is_active: boolean }
    return { mentorPublicId: r.id, alias: r.alias, isActive: r.is_active }
  })
  out.sort((a, b) => a.alias.localeCompare(b.alias))
  return out
}

/**
 * All active mentors (alias-only) as assignment options. ADMIN-gated.
 */
async function allMentorOptions(): Promise<MentorOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_public')
    .select('id, alias, is_active')
    .eq('is_active', true)
    .order('alias', { ascending: true })

  if (error) {
    throw new Error(`Failed to load mentors: ${error.message}`)
  }
  return (data ?? []).map((m) => ({ mentorPublicId: m.id, alias: m.alias }))
}

/**
 * Full admin detail for one session's module design: the session row, the
 * school's mentor team (allocated), and the mentors still available to add.
 * Returns null when the session does not exist. ADMIN / SUPER_ADMIN ONLY.
 */
export async function getSessionDesignDetail(
  sessionId: string
): Promise<SessionDesignDetail | null> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, school_id, grade, session_date, start_time, status, schools!inner(name)'
    )
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load session: ${error.message}`)
  }
  if (!data) return null

  const row = data as unknown as {
    id: string
    school_id: string
    grade: string
    session_date: string | null
    start_time: string | null
    status: SessionStatus
    schools: { name: string } | { name: string }[]
  }
  const rel = row.schools
  const school = Array.isArray(rel) ? rel[0] : rel

  const [moduleMap, design, assignedMentors, mentorOptions] =
    await Promise.all([
      moduleCodeBySchool(),
      getSessionDesignRow(row.id),
      mentorsForSession(row.id),
      allMentorOptions(),
    ])

  const mod = moduleMap.get(row.school_id)
  const assignedIds = new Set(assignedMentors.map((m) => m.mentorPublicId))
  const availableMentors = mentorOptions.filter(
    (m) => !assignedIds.has(m.mentorPublicId)
  )

  const session: WorkspaceSession = {
    id: row.id,
    schoolId: row.school_id,
    schoolName: school?.name ?? '(unknown school)',
    grade: row.grade,
    sessionDate: row.session_date,
    startTime: row.start_time,
    status: row.status,
    confirmedModuleCode: mod?.confirmed ?? null,
    computedModuleCode: mod?.computed ?? null,
    designedModuleCode: design.moduleCode,
  }

  return { session, plan: design.plan, assignedMentors, availableMentors }
}

/**
 * Resolve a mentor_public.id -> mentor_profiles.id (admin-gated). Allocation
 * mutations operate on mentor_profiles.id but the UI carries the public id.
 * Returns null if not found.
 */
export async function resolveMentorProfileId(
  mentorPublicId: string
): Promise<string | null> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_public')
    .select('mentor_profile_id')
    .eq('id', mentorPublicId)
    .maybeSingle<{ mentor_profile_id: string }>()
  if (error) {
    throw new Error(`Failed to resolve mentor: ${error.message}`)
  }
  return data?.mentor_profile_id ?? null
}

