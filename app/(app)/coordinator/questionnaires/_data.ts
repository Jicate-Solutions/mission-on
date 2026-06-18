import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/coordinator/questionnaires/_data.ts
//
// Coordinator-facing questionnaire data (PRD §7.2, §7.3, §9.3). A coordinator
// ISSUES the fixed questionnaire to a school they own and TRACKS completion —
// but NEVER sees the computed module code. Every read here goes through the
// classification-free path:
//   - lifecycle rows read DIRECTLY from questionnaire_responses (now a
//     classification-free parent — the 8 classification columns moved to the
//     admin-only questionnaire_classification child table, 0006). Coordinators
//     are scoped by the qresponses_coordinator_select RLS policy; the DAL still
//     projects ONLY the safe lifecycle/answers columns as a defensive habit.
//   - schools the coordinator owns via the RLS-scoped schools SELECT policy.
//
// Admins/super_admins are allowed to use the coordinator pages too (the group
// layout admits them for oversight); for them the same RLS simply scopes to
// rows they may read. Either way, NO classification leaves this module.
// =============================================================================

import { requireRole } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type {
  QuestionnaireStatus,
  TemplateQuestion,
} from '@/types/database'

const COORDINATOR_ROLES = ['coordinator', 'admin', 'super_admin'] as const

/** A school the coordinator owns, with its current questionnaire (if any). */
export interface CoordinatorSchoolQuestionnaire {
  schoolId: string
  schoolName: string
  pipelineStage: string
  schoolStatus: string
  /** Null when no questionnaire has been issued yet. */
  responseId: string | null
  questionnaireStatus: QuestionnaireStatus | null
  issuedAt: string | null
  completedAt: string | null
  /** Number of answers captured so far (lifecycle progress only). */
  answeredCount: number | null
}

interface SchoolRowShape {
  id: string
  name: string
  pipeline_stage: string
  status: string
}

interface CoordinatorResponseRowShape {
  id: string
  school_id: string
  status: QuestionnaireStatus
  issued_at: string | null
  completed_at: string | null
}

/**
 * The active questionnaire template (fixed form). Coordinators may read the
 * active template (qtemplates_select policy). Returns null if none is active.
 */
export interface ActiveTemplate {
  id: string
  title: string
  version: number
  questions: TemplateQuestion[]
}

export async function getActiveTemplate(): Promise<ActiveTemplate | null> {
  await requireRole(COORDINATOR_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('questionnaire_templates')
    .select('id, title, version, questions')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load active template: ${error.message}`)
  }
  if (!data) return null

  const t = data as {
    id: string
    title: string
    version: number
    questions: TemplateQuestion[]
  }
  return {
    id: t.id,
    title: t.title,
    version: t.version,
    questions: t.questions ?? [],
  }
}

/**
 * List the coordinator's own schools joined to their questionnaire lifecycle
 * (issued/completed status only). NO classification. Newest school activity
 * first by school name for a stable display.
 */
export async function getCoordinatorQuestionnaires(): Promise<
  CoordinatorSchoolQuestionnaire[]
> {
  await requireRole(COORDINATOR_ROLES)
  const supabase = await createClient()

  // Schools the coordinator can see (RLS scopes to owned schools for a
  // coordinator; admins see all).
  const { data: schoolsData, error: schoolsError } = await supabase
    .from('schools')
    .select('id, name, pipeline_stage, status')
    .order('name', { ascending: true })

  if (schoolsError) {
    throw new Error(`Failed to load schools: ${schoolsError.message}`)
  }
  const schools = (schoolsData ?? []) as SchoolRowShape[]
  if (schools.length === 0) return []

  // Lifecycle rows read directly from the classification-free parent (RLS scopes
  // a coordinator to their owned schools). Project only safe lifecycle columns.
  const { data: respData, error: respError } = await supabase
    .from('questionnaire_responses')
    .select('id, school_id, status, issued_at, completed_at')

  if (respError) {
    throw new Error(`Failed to load questionnaire lifecycle: ${respError.message}`)
  }
  const responses = (respData ?? []) as CoordinatorResponseRowShape[]
  const bySchool = new Map<string, CoordinatorResponseRowShape>()
  for (const r of responses) bySchool.set(r.school_id, r)

  return schools.map((s) => {
    const r = bySchool.get(s.id) ?? null
    return {
      schoolId: s.id,
      schoolName: s.name,
      pipelineStage: s.pipeline_stage,
      schoolStatus: s.status,
      responseId: r?.id ?? null,
      questionnaireStatus: r?.status ?? null,
      issuedAt: r?.issued_at ?? null,
      completedAt: r?.completed_at ?? null,
      answeredCount: null,
    }
  })
}

/**
 * One school's questionnaire lifecycle detail for the coordinator (no
 * classification). Includes the captured answers so the coordinator can see /
 * continue the fixed-form capture, but never the computed module code.
 */
export interface CoordinatorQuestionnaireDetail {
  schoolId: string
  schoolName: string
  responseId: string | null
  status: QuestionnaireStatus | null
  issuedAt: string | null
  completedAt: string | null
  answers: Record<string, string>
  template: ActiveTemplate | null
}

export async function getCoordinatorQuestionnaireForSchool(
  schoolId: string
): Promise<CoordinatorQuestionnaireDetail | null> {
  await requireRole(COORDINATOR_ROLES)
  const supabase = await createClient()

  const { data: schoolData, error: schoolError } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', schoolId)
    .maybeSingle()

  if (schoolError) {
    throw new Error(`Failed to load school: ${schoolError.message}`)
  }
  if (!schoolData) return null
  const school = schoolData as { id: string; name: string }

  const template = await getActiveTemplate()

  // Lifecycle + answers read directly from the classification-free parent. The
  // parent now carries NO classification columns (those moved to the admin-only
  // questionnaire_classification child), so `answers` is safe to read here — a
  // coordinator captures these answers and needs them to continue the fixed-form
  // capture. RLS (qresponses_coordinator_select) scopes the row to their school.
  const { data: respData, error: respError } = await supabase
    .from('questionnaire_responses')
    .select('id, school_id, status, issued_at, completed_at, answers')
    .eq('school_id', schoolId)
    .maybeSingle()

  if (respError) {
    throw new Error(`Failed to load questionnaire: ${respError.message}`)
  }
  const resp = respData as
    | (CoordinatorResponseRowShape & { answers: Record<string, string> | null })
    | null

  return {
    schoolId: school.id,
    schoolName: school.name,
    responseId: resp?.id ?? null,
    status: resp?.status ?? null,
    issuedAt: resp?.issued_at ?? null,
    completedAt: resp?.completed_at ?? null,
    answers: resp?.answers ?? {},
    template,
  }
}
