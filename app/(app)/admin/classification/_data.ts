import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/classification/_data.ts
//
// Admin/super_admin-ONLY data access for the program-wide CLASSIFICATION VIEW
// (PRD §6). This is a LOCAL DAL extension owned by the classification-view
// module. It follows the same contract as lib/dal and the sibling
// questionnaires/_data.ts:
//   - every exported function re-verifies session + role internally
//     (requireRole(['admin','super_admin'])) — never trusts a page-level gate;
//   - it returns ALLOW-LISTED DTOs (no minor PII; questionnaire classification
//     is about the cohort/school, not an individual learner);
//   - classification columns (computed_/confirmed_module_code, confidence,
//     divergence) live in the admin-only questionnaire_classification child
//     table and are exposed HERE ONLY, via an embedded join, on this
//     admin-guarded path. Never on any coordinator/learner-reachable route.
//
// Reads go through the RLS-scoped SSR client: the qresponses_admin_select
// policy admits the parent to admins, and the qclass_admin_all policy admits
// the embedded questionnaire_classification join to admins only.
// =============================================================================

import { requireRole } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type {
  CategoryACode,
  CategoryBCode,
  ModuleCode,
} from '@/types/database'

const ADMIN_ROLES = ['admin', 'super_admin'] as const

/** The nine module codes of the 3×3 matrix, in matrix order (PRD §6.3). */
export const CATEGORY_A_CODES: CategoryACode[] = ['A1', 'A2', 'A3']
export const CATEGORY_B_CODES: CategoryBCode[] = ['B1', 'B2', 'B3']

/**
 * One school's classification as the admin/super_admin Classification view sees
 * it: the school, its computed and confirmed module codes, confidence and the
 * divergence flag, plus the response id used to deep-link into the questionnaire
 * detail (where a divergent code is confirmed). Admin-only by construction.
 */
export interface SchoolClassificationItem {
  responseId: string
  schoolId: string
  schoolName: string
  computedACode: CategoryACode | null
  computedBCode: CategoryBCode | null
  computedModuleCode: ModuleCode | null
  confirmedModuleCode: ModuleCode | null
  divergenceFlag: boolean
  confidence: number | null
  /** The module code currently in effect: confirmed if present, else computed. */
  effectiveModuleCode: ModuleCode | null
}

/** One cell of the 3×3 distribution matrix. */
export interface MatrixCell {
  aCode: CategoryACode
  bCode: CategoryBCode
  moduleCode: ModuleCode
  count: number
}

export interface ClassificationOverview {
  schools: SchoolClassificationItem[]
  /** 3×3 distribution by EFFECTIVE module code (row = A, col = B). */
  matrix: MatrixCell[]
  totalClassified: number
  totalConfirmed: number
  totalDiverged: number
  totalUnclassified: number
}

/**
 * The embedded classification child as PostgREST returns it. A one-to-one embed
 * may come back as an object or a single-element array; we normalise both.
 */
interface ClassificationShape {
  computed_a_code: CategoryACode | null
  computed_b_code: CategoryBCode | null
  computed_module_code: ModuleCode | null
  confirmed_module_code: ModuleCode | null
  divergence_flag: boolean
  confidence: number | null
}

interface ResponseRowShape {
  id: string
  school_id: string
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

function moduleCode(a: CategoryACode, b: CategoryBCode): ModuleCode {
  return `${a}-${b}` as ModuleCode
}

const SELECT =
  'id, school_id, schools ( name ), questionnaire_classification ( computed_a_code, computed_b_code, computed_module_code, confirmed_module_code, divergence_flag, confidence )'

/**
 * Program-wide classification overview: every school's computed/confirmed module
 * code with the divergence flag, plus the 3×3 distribution by effective module
 * code. ADMIN / SUPER_ADMIN ONLY (re-verified at the data layer). Only responses
 * that actually carry a classification row are returned (one row per school).
 */
export async function getClassificationOverview(): Promise<ClassificationOverview> {
  await requireRole(ADMIN_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select(SELECT)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load classification overview: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as ResponseRowShape[]

  const schools: SchoolClassificationItem[] = rows
    .filter((r) => classification(r) !== null)
    .map((r) => {
      const c = classification(r)!
      const effective = c.confirmed_module_code ?? c.computed_module_code ?? null
      return {
        responseId: r.id,
        schoolId: r.school_id,
        schoolName: schoolName(r),
        computedACode: c.computed_a_code,
        computedBCode: c.computed_b_code,
        computedModuleCode: c.computed_module_code,
        confirmedModuleCode: c.confirmed_module_code,
        divergenceFlag: c.divergence_flag,
        confidence: c.confidence,
        effectiveModuleCode: effective,
      }
    })

  // Build the 3×3 distribution by effective module code.
  const counts = new Map<ModuleCode, number>()
  for (const s of schools) {
    if (s.effectiveModuleCode) {
      counts.set(
        s.effectiveModuleCode,
        (counts.get(s.effectiveModuleCode) ?? 0) + 1
      )
    }
  }

  const matrix: MatrixCell[] = []
  for (const a of CATEGORY_A_CODES) {
    for (const b of CATEGORY_B_CODES) {
      const code = moduleCode(a, b)
      matrix.push({
        aCode: a,
        bCode: b,
        moduleCode: code,
        count: counts.get(code) ?? 0,
      })
    }
  }

  const totalConfirmed = schools.filter(
    (s) => s.confirmedModuleCode !== null
  ).length
  const totalClassified = schools.filter(
    (s) => s.effectiveModuleCode !== null
  ).length
  const totalDiverged = schools.filter((s) => s.divergenceFlag).length
  const totalUnclassified = schools.length - totalClassified

  return {
    schools,
    matrix,
    totalClassified,
    totalConfirmed,
    totalDiverged,
    totalUnclassified,
  }
}
