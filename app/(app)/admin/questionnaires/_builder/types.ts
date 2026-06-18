// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/questionnaires/_builder/types.ts — DTO + draft shapes for the
// Questionnaire Builder (PRD §7.3 / §15 Phase 2).
//
// SHAPE CONTRACT (critical): the saved template `questions` jsonb MUST stay
// readable by lib/classification.ts unchanged. The engine reads exactly:
//   TemplateQuestion = { id, category, text, options: QuestionOption[] }
//   QuestionOption   = { value, label, weight, code? }   (code in A1..A3 / B1..B3)
// These builder types are the EDITABLE mirror of those wire types. The actions
// layer converts a BuilderDraft back into the canonical TemplateQuestion[] before
// persisting, so what the engine reads never drifts from what the seed defined
// (supabase/migrations/0004_seed.sql).
//
// This is an admin-only local module (owned by the builder). Nothing here is ever
// imported into a coordinator/learner/mentor-reachable path — templates carry no
// PII, but the builder WRITE path is admin/super_admin only by RLS + requireRole.
// =============================================================================

import type {
  CategoryACode,
  CategoryBCode,
  QuestionCategory,
  TemplateQuestion,
} from '@/types/database'

/** The three question categories the classification engine understands. */
export const QUESTION_CATEGORIES: readonly QuestionCategory[] = [
  'A_demographic',
  'A_behaviour',
  'B',
] as const

/** Category A codes an option may nudge toward (A_demographic / A_behaviour). */
export const A_CODES: readonly CategoryACode[] = ['A1', 'A2', 'A3'] as const

/** Category B codes an option may nudge toward (B). */
export const B_CODES: readonly CategoryBCode[] = ['B1', 'B2', 'B3'] as const

/** Human labels for the category select. */
export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  A_demographic: 'A — Demographic (authoritative: fee bracket + school type)',
  A_behaviour: 'A — Behaviour (pattern signal, reconciled vs demographic)',
  B: 'B — Usage reality (resolves B1/B2/B3)',
}

/**
 * The active template as the builder loads it: identity + the canonical question
 * array. `questions` is the EXACT shape lib/classification.ts consumes.
 */
export interface BuilderTemplate {
  id: string
  version: number
  title: string
  isActive: boolean
  questions: TemplateQuestion[]
}

/**
 * One option in the editable draft. Mirrors QuestionOption but keeps `code` as a
 * possibly-empty string for form ergonomics; actions.ts normalises '' -> absent.
 */
export interface BuilderOption {
  value: string
  label: string
  weight: number
  /** '' means "no code" (the engine treats a code-less option as a non-vote). */
  code: '' | CategoryACode | CategoryBCode
}

/** One question in the editable draft (mirrors TemplateQuestion). */
export interface BuilderQuestion {
  id: string
  category: QuestionCategory
  text: string
  options: BuilderOption[]
}

/** The whole editable draft the client form holds + submits. */
export interface BuilderDraft {
  title: string
  questions: BuilderQuestion[]
}

/** Result of a save action (mirrors the house ActionResult pattern). */
export interface BuilderActionResult {
  ok: boolean
  error: string | null
  /** On success: the new version number that was published. */
  newVersion?: number
  /**
   * On success but with a non-fatal caveat (e.g. program_config.active_template
   * _version could not be updated because the caller is admin, not super_admin).
   * The new version is still active via is_active; this is informational.
   */
  warning?: string | null
}
