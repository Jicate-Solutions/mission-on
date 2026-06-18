import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/questionnaires/_data.ts
//
// Admin/super_admin-ONLY data access for questionnaire CLASSIFICATION results
// (PRD §6, §7.3). This is a LOCAL DAL extension owned by the
// questionnaire-classification module. It follows the same contract as lib/dal:
//   - every exported function re-verifies session + role internally
//     (requireRole(['admin','super_admin'])) — never trusts a page-level gate;
//   - it returns ALLOW-LISTED DTOs (no minor PII; questionnaire answers are
//     about the cohort, not an individual learner — see PRD §16 assumption);
//   - classification columns (computed_/confirmed_module_code, confidence,
//     divergence) live in the admin-only questionnaire_classification child table
//     (0006) and are exposed HERE ONLY, via an embedded join; never on any
//     coordinator-reachable path.
//
// Reads go through the RLS-scoped SSR client: the qresponses_admin_select policy
// admits the parent to admins, and the qclass_admin_all policy admits the child
// (the embedded questionnaire_classification join) to admins only.
// =============================================================================

import { requireRole } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type {
  CategoryACode,
  CategoryBCode,
  ModuleCode,
  QuestionnaireAnswers,
  QuestionnaireStatus,
  TemplateQuestion,
} from '@/types/database'

const ADMIN_ROLES = ['admin', 'super_admin'] as const

/**
 * One questionnaire response row as an ADMIN sees it in the list: lifecycle plus
 * the computed/confirmed classification. This DTO is admin-only by construction.
 */
export interface AdminQuestionnaireListItem {
  id: string
  schoolId: string
  schoolName: string
  templateId: string
  status: QuestionnaireStatus
  computedModuleCode: ModuleCode | null
  confirmedModuleCode: ModuleCode | null
  divergenceFlag: boolean
  confidence: number | null
  issuedAt: string | null
  completedAt: string | null
  updatedAt: string
}

/**
 * Full admin detail of one response: list fields plus the raw answers and the
 * template question definitions needed to render answers in human-readable form.
 */
export interface AdminQuestionnaireDetail extends AdminQuestionnaireListItem {
  computedACode: CategoryACode | null
  computedBCode: CategoryBCode | null
  confirmedBy: string | null
  confirmedAt: string | null
  answers: QuestionnaireAnswers
  templateTitle: string
  templateVersion: number
  questions: TemplateQuestion[]
}

/**
 * The embedded classification child as PostgREST returns it. A one-to-one
 * embed may come back as an object or a single-element array; we normalise both.
 */
interface ClassificationShape {
  computed_a_code: CategoryACode | null
  computed_b_code: CategoryBCode | null
  computed_module_code: ModuleCode | null
  confirmed_module_code: ModuleCode | null
  divergence_flag: boolean
  confidence: number | null
  confirmed_by: string | null
  confirmed_at: string | null
}

interface ResponseRowShape {
  id: string
  school_id: string
  template_id: string
  answers: QuestionnaireAnswers
  status: QuestionnaireStatus
  issued_at: string | null
  completed_at: string | null
  updated_at: string
  schools: { name: string } | { name: string }[] | null
  questionnaire_classification:
    | ClassificationShape
    | ClassificationShape[]
    | null
}

function schoolName(row: ResponseRowShape): string {
  const s = row.schools
  if (!s) return 'Unknown school'
  return Array.isArray(s) ? (s[0]?.name ?? 'Unknown school') : s.name
}

/** Normalise the embedded classification child to a single object (or null). */
function classification(row: ResponseRowShape): ClassificationShape | null {
  const c = row.questionnaire_classification
  if (!c) return null
  return Array.isArray(c) ? (c[0] ?? null) : c
}

const LIST_SELECT =
  'id, school_id, template_id, status, issued_at, completed_at, updated_at, schools ( name ), questionnaire_classification ( computed_module_code, confirmed_module_code, divergence_flag, confidence )'

const DETAIL_SELECT =
  'id, school_id, template_id, answers, status, issued_at, completed_at, updated_at, schools ( name ), questionnaire_classification ( computed_a_code, computed_b_code, computed_module_code, confirmed_module_code, divergence_flag, confidence, confirmed_by, confirmed_at )'

/**
 * List all questionnaire responses with their classification, newest first.
 * ADMIN / SUPER_ADMIN ONLY (re-verified). Writes a classification.read audit.
 */
export async function getAdminQuestionnaireList(): Promise<
  AdminQuestionnaireListItem[]
> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select(LIST_SELECT)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load questionnaire responses: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as ResponseRowShape[]
  return rows.map((r) => {
    const c = classification(r)
    return {
      id: r.id,
      schoolId: r.school_id,
      schoolName: schoolName(r),
      templateId: r.template_id,
      status: r.status,
      computedModuleCode: c?.computed_module_code ?? null,
      confirmedModuleCode: c?.confirmed_module_code ?? null,
      divergenceFlag: c?.divergence_flag ?? false,
      confidence: c?.confidence ?? null,
      issuedAt: r.issued_at,
      completedAt: r.completed_at,
      updatedAt: r.updated_at,
    }
  })
}

/**
 * Full classification detail for one response (raw answers + question text).
 * ADMIN / SUPER_ADMIN ONLY. Returns null when the row is not found / not
 * visible. The caller (detail page) is responsible for the classification.read
 * audit so it is written once per actual view, not per data helper call.
 */
export async function getAdminQuestionnaireDetail(
  responseId: string
): Promise<AdminQuestionnaireDetail | null> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select(DETAIL_SELECT)
    .eq('id', responseId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load questionnaire response: ${error.message}`)
  }
  if (!data) return null

  const r = data as unknown as ResponseRowShape

  // Pull the template definition to render answers and show version/title.
  const { data: tpl, error: tplError } = await supabase
    .from('questionnaire_templates')
    .select('title, version, questions')
    .eq('id', r.template_id)
    .maybeSingle()

  if (tplError) {
    throw new Error(`Failed to load questionnaire template: ${tplError.message}`)
  }

  const template = tpl as
    | { title: string; version: number; questions: TemplateQuestion[] }
    | null

  const c = classification(r)

  return {
    id: r.id,
    schoolId: r.school_id,
    schoolName: schoolName(r),
    templateId: r.template_id,
    status: r.status,
    computedACode: c?.computed_a_code ?? null,
    computedBCode: c?.computed_b_code ?? null,
    computedModuleCode: c?.computed_module_code ?? null,
    confirmedModuleCode: c?.confirmed_module_code ?? null,
    divergenceFlag: c?.divergence_flag ?? false,
    confidence: c?.confidence ?? null,
    confirmedBy: c?.confirmed_by ?? null,
    confirmedAt: c?.confirmed_at ?? null,
    issuedAt: r.issued_at,
    completedAt: r.completed_at,
    updatedAt: r.updated_at,
    answers: r.answers ?? {},
    templateTitle: template?.title ?? 'Questionnaire',
    templateVersion: template?.version ?? 0,
    questions: template?.questions ?? [],
  }
}
