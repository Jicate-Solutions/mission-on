// =============================================================================
// Mission ON — Smart Choices
// lib/classification.ts — The 3x3 classification engine (PRD §6.5).
//
// PURE + UNIT-TESTABLE. No I/O, no Supabase, no 'server-only'. The DAL imports
// these functions to compute a module code from a school's questionnaire
// answers; the OUTPUT is admin/super_admin-visible only (the DAL enforces that,
// not this file).
//
// MATRIX (PRD §6):
//   Category A (demographic, AUTHORITATIVE)  — derived from fee bracket + type:
//     A1 = private, fees above ₹1,00,000/yr   (fee_above_1l)
//     A2 = private, fees below ₹1,00,000/yr   (fee_below_1l)
//     A3 = government                         (govt)
//   Category A (behaviour) — a pattern SIGNAL tallied from A_behaviour answers;
//     reconciled against the demographic anchor. If they diverge by MORE THAN 1
//     ordinal step (A1=1, A2=2, A3=3), the school is flagged for Admin confirm.
//   Category B (usage reality) — tallied from B answers -> B1/B2/B3.
//   Module = `${A}-${B}` (e.g. "A2-B2").
// =============================================================================

import type {
  CategoryACode,
  CategoryBCode,
  ClassificationResult,
  FeeBracket,
  ModuleCode,
  QuestionOption,
  QuestionnaireAnswers,
  SchoolType,
  TemplateQuestion,
} from '@/types/database'

// -----------------------------------------------------------------------------
// Ordinal helpers. Category A/B codes are ordinal: A1<A2<A3, B1<B2<B3.
// -----------------------------------------------------------------------------

const A_ORDINAL: Record<CategoryACode, number> = { A1: 1, A2: 2, A3: 3 }
const A_BY_ORDINAL: Record<number, CategoryACode> = { 1: 'A1', 2: 'A2', 3: 'A3' }

const B_ORDINAL: Record<CategoryBCode, number> = { B1: 1, B2: 2, B3: 3 }
const B_BY_ORDINAL: Record<number, CategoryBCode> = { 1: 'B1', 2: 'B2', 3: 'B3' }

/**
 * Absolute ordinal distance between two Category A codes (A1=1, A2=2, A3=3).
 * Mirrors the SQL classification_distance() helper. The PRD flags a school when
 * demographic and behavioural signals diverge by MORE THAN 1 step.
 */
export function ordinalDistanceA(a: CategoryACode, b: CategoryACode): number {
  return Math.abs(A_ORDINAL[a] - A_ORDINAL[b])
}

// -----------------------------------------------------------------------------
// STEP 1a — Authoritative Category A from fee bracket + school type.
// This is the source of truth for A1/A2/A3 (PRD: "Category A is anchored on fee
// bracket + school type first, then confirmed by behavioural pattern").
// -----------------------------------------------------------------------------

/**
 * Derive the AUTHORITATIVE Category A code from the school's fee bracket and
 * type. Government always resolves A3 regardless of bracket; a private school
 * resolves A1 (fee_above_1l) or A2 (fee_below_1l).
 */
export function deriveCategoryA(
  feeBracket: FeeBracket,
  schoolType: SchoolType
): CategoryACode {
  // Government short-circuits to A3 (fee bracket not applicable).
  if (schoolType === 'government' || feeBracket === 'govt') return 'A3'
  if (feeBracket === 'fee_above_1l') return 'A1'
  // fee_below_1l (and any private fallthrough) -> A2.
  return 'A2'
}

// -----------------------------------------------------------------------------
// Answer-tally machinery. Each chosen option may carry a `code` (the A/B code it
// nudges toward) and a numeric `weight`. We tally weighted votes per code and
// pick the winner; confidence is winner_votes / total_votes.
// -----------------------------------------------------------------------------

interface TallyOutcome<TCode extends string> {
  /** Winning code, or null when no codes were resolvable from the answers. */
  code: TCode | null
  /** winner weight / total weight, in [0, 1]; 0 when nothing tallied. */
  confidence: number
  /** Per-code accumulated weight (for diagnostics / tie inspection). */
  weights: Record<string, number>
}

/**
 * Generic weighted tally over the answered options for one question category.
 * `orderTieBreak` lists codes from lowest to highest ordinal so ties resolve
 * deterministically toward the LOWER (more cautious) code.
 */
function tally<TCode extends string>(
  questions: TemplateQuestion[],
  answers: QuestionnaireAnswers,
  category: TemplateQuestion['category'],
  orderTieBreak: TCode[]
): TallyOutcome<TCode> {
  const weights: Record<string, number> = {}
  let total = 0

  for (const q of questions) {
    if (q.category !== category) continue
    const chosenValue = answers[q.id]
    if (chosenValue === undefined) continue
    const option: QuestionOption | undefined = q.options.find(
      (o) => o.value === chosenValue
    )
    if (!option || option.code === undefined) continue

    const code = option.code as string
    // A behavioural/usage option contributes its weight (default 1) per vote.
    const w = Number.isFinite(option.weight) ? option.weight : 1
    const contribution = w > 0 ? w : 1
    weights[code] = (weights[code] ?? 0) + contribution
    total += contribution
  }

  if (total === 0) {
    return { code: null, confidence: 0, weights }
  }

  // Pick the highest-weight code; break ties toward the LOWER ordinal.
  let winner: TCode | null = null
  let winnerWeight = -1
  for (const code of orderTieBreak) {
    const w = weights[code] ?? 0
    if (w > winnerWeight) {
      winner = code
      winnerWeight = w
    }
  }

  return {
    code: winner,
    confidence: winnerWeight > 0 ? winnerWeight / total : 0,
    weights,
  }
}

/**
 * Tally the A_behaviour pattern signal -> A1/A2/A3 (NOT authoritative; used only
 * to detect divergence from the demographic anchor). Returns null when no
 * behavioural answers resolved a code.
 */
export function tallyCategoryAbehaviour(
  questions: TemplateQuestion[],
  answers: QuestionnaireAnswers
): { code: CategoryACode | null; confidence: number } {
  const r = tally<CategoryACode>(questions, answers, 'A_behaviour', [
    'A1',
    'A2',
    'A3',
  ])
  return { code: r.code, confidence: r.confidence }
}

/**
 * Tally Category B usage answers -> B1/B2/B3. Returns null when no B answers
 * resolved a code (the engine then falls back to the most cautious B1).
 */
export function tallyCategoryB(
  questions: TemplateQuestion[],
  answers: QuestionnaireAnswers
): { code: CategoryBCode | null; confidence: number } {
  const r = tally<CategoryBCode>(questions, answers, 'B', ['B1', 'B2', 'B3'])
  return { code: r.code, confidence: r.confidence }
}

// -----------------------------------------------------------------------------
// STEP 3 — Compose the module code + confidence + flags.
// -----------------------------------------------------------------------------

export interface ComputeModuleInput {
  feeBracket: FeeBracket
  schoolType: SchoolType
  questions: TemplateQuestion[]
  answers: QuestionnaireAnswers
}

export const A_DIVERGENCE_FLAG = 'A_DIVERGENCE — Admin confirm'
const B_UNRESOLVED_FLAG = 'B_UNRESOLVED — defaulted to B1, Admin confirm'

/**
 * Run the full engine. AUTHORITATIVE A from demographics; B from the usage
 * tally (defaulting to the most cautious B1 if unresolved); divergence flag when
 * the behavioural A signal is more than one ordinal step from the demographic A.
 *
 * Returns a ClassificationResult. The DAL writes computed_a_code /
 * computed_b_code / computed_module_code / confidence / divergence_flag to
 * questionnaire_responses — and exposes them to admin/super_admin ONLY.
 */
export function computeModule(input: ComputeModuleInput): ClassificationResult {
  const flags: string[] = []

  // STEP 1a — authoritative demographic A.
  const aDemographic = deriveCategoryA(input.feeBracket, input.schoolType)

  // STEP 1b — behavioural A pattern signal + divergence check.
  const aBehaviour = tallyCategoryAbehaviour(input.questions, input.answers)
  let divergenceFlag = false
  if (aBehaviour.code !== null) {
    const distance = ordinalDistanceA(aDemographic, aBehaviour.code)
    if (distance > 1) {
      divergenceFlag = true
      flags.push(A_DIVERGENCE_FLAG)
    }
  }

  // STEP 2 — Category B usage.
  const bTally = tallyCategoryB(input.questions, input.answers)
  let bCode: CategoryBCode = bTally.code ?? 'B1'
  if (bTally.code === null) {
    flags.push(B_UNRESOLVED_FLAG)
  }
  // Defensive: ensure bCode is a valid B code.
  if (B_ORDINAL[bCode] === undefined) bCode = 'B1'

  // STEP 3 — module code.
  const moduleCode = `${aDemographic}-${bCode}` as ModuleCode

  // Confidence: blend the B usage confidence with a divergence penalty. The
  // demographic anchor is authoritative (confidence 1 for A); B drives the
  // module's behavioural axis, so we weight on bTally and halve when diverged.
  const bConfidence = bTally.code !== null ? bTally.confidence : 0
  let confidence = bConfidence
  if (divergenceFlag) confidence = confidence * 0.5
  // Clamp + round to 3 decimals (matches numeric(4,3) in the schema).
  confidence = Math.max(0, Math.min(1, confidence))
  confidence = Math.round(confidence * 1000) / 1000

  return {
    computed_a_code: aDemographic,
    computed_b_code: bCode,
    computed_module_code: moduleCode,
    confidence,
    divergence_flag: divergenceFlag,
    flags,
  }
}

// Re-export the ordinal maps for any caller needing the ordinal scale.
export const CATEGORY_A_ORDINAL = A_ORDINAL
export const CATEGORY_B_ORDINAL = B_ORDINAL
export { A_BY_ORDINAL, B_BY_ORDINAL }
