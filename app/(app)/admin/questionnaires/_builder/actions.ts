'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/questionnaires/_builder/actions.ts — Admin Server Actions for
// the Questionnaire Builder (PRD §7.3 / §15 Phase 2).
//
// SECURITY (Next.js 16): a Server Action is reachable by a DIRECT POST, so a
// page-level gate does NOT protect it. EVERY action re-verifies
// requireRole(['admin','super_admin']) internally before mutating. The write runs
// under the admin's RLS context: qtemplates_admin_write requires is_admin_role(),
// which covers both admin and super_admin.
//
// VERSIONING DECISION (baked, least-destructive):
//   questionnaire_templates supports MULTIPLE versioned rows (version int with
//   unique(version), is_active boolean) and questionnaire_responses.template_id is
//   an FK to a specific template row — so existing responses keep their template.
//   Therefore SAVING a builder edit INSERTS A NEW VERSION row
//   (version = max + 1, is_active = true) and flips all previous rows to
//   is_active = false. Old versions are preserved; in-flight responses are
//   unaffected; the classification engine reads each response's own template_id.
//
//   We also try to update program_config.active_template_version to the new
//   version (the documented convention). BUT program_config_super_admin_write
//   requires SUPER_ADMIN, while qtemplates_admin_write allows ADMIN. So an admin
//   CAN publish a new template version but CANNOT update program_config. We treat
//   that program_config update as best-effort: the active template is also fully
//   resolvable via is_active = true (which is what the builder reads), so failing
//   to bump program_config is reported as a non-fatal WARNING, not an error.
//
// SHAPE CONTRACT (critical): we validate + normalise the submitted draft into the
// canonical TemplateQuestion[] / QuestionOption[] shape that lib/classification.ts
// consumes, BEFORE persisting. This guarantees the saved jsonb keeps the engine
// working (mirror of supabase/migrations/0004_seed.sql).
// =============================================================================

import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type {
  CategoryACode,
  CategoryBCode,
  QuestionCategory,
  QuestionOption,
  TemplateQuestion,
} from '@/types/database'

import { getMaxTemplateVersion } from './queries'
import type {
  BuilderActionResult,
  BuilderDraft,
  BuilderOption,
  BuilderQuestion,
} from './types'

const ADMIN_ROLES = ['admin', 'super_admin'] as const

const VALID_CATEGORIES: ReadonlySet<QuestionCategory> = new Set([
  'A_demographic',
  'A_behaviour',
  'B',
])
const A_CODES: ReadonlySet<string> = new Set(['A1', 'A2', 'A3'])
const B_CODES: ReadonlySet<string> = new Set(['B1', 'B2', 'B3'])

/** A slug-safe id: lowercase letters, digits, underscores. */
const ID_RE = /^[a-z0-9_]+$/

class ValidationError extends Error {}

// -----------------------------------------------------------------------------
// Validation + normalisation: BuilderDraft -> canonical TemplateQuestion[].
// Throws ValidationError with a human message on the first problem found.
// -----------------------------------------------------------------------------

function normaliseOption(
  opt: BuilderOption,
  category: QuestionCategory,
  qLabel: string
): QuestionOption {
  const value = (opt.value ?? '').trim()
  const label = (opt.label ?? '').trim()
  if (!value) throw new ValidationError(`${qLabel}: an option is missing its value.`)
  if (!ID_RE.test(value)) {
    throw new ValidationError(
      `${qLabel}: option value "${value}" may use only lowercase letters, digits and underscores.`
    )
  }
  if (!label) throw new ValidationError(`${qLabel}: option "${value}" is missing a label.`)

  const weight = Number(opt.weight)
  if (!Number.isFinite(weight) || weight < 0) {
    throw new ValidationError(
      `${qLabel}: option "${value}" weight must be a number ≥ 0.`
    )
  }

  // Normalise the code. '' (or whitespace) means "no code" — a code-less option
  // is a non-vote in the engine's tally (it is skipped). When a code is present
  // it MUST be valid for the question's category axis.
  const rawCode = (opt.code ?? '').trim()
  const out: QuestionOption = { value, label, weight }
  if (rawCode) {
    if (category === 'B') {
      if (!B_CODES.has(rawCode)) {
        throw new ValidationError(
          `${qLabel}: option "${value}" has code "${rawCode}", but a B question may only use B1/B2/B3.`
        )
      }
      out.code = rawCode as CategoryBCode
    } else {
      // A_demographic / A_behaviour both use A codes.
      if (!A_CODES.has(rawCode)) {
        throw new ValidationError(
          `${qLabel}: option "${value}" has code "${rawCode}", but an A question may only use A1/A2/A3.`
        )
      }
      out.code = rawCode as CategoryACode
    }
  }
  return out
}

function normaliseQuestion(q: BuilderQuestion, index: number): TemplateQuestion {
  const id = (q.id ?? '').trim()
  const text = (q.text ?? '').trim()
  const human = id ? `Question "${id}"` : `Question #${index + 1}`

  if (!id) throw new ValidationError(`${human}: a question is missing its id.`)
  if (!ID_RE.test(id)) {
    throw new ValidationError(
      `${human}: id may use only lowercase letters, digits and underscores.`
    )
  }
  if (!VALID_CATEGORIES.has(q.category)) {
    throw new ValidationError(`${human}: invalid category "${q.category}".`)
  }
  if (!text) throw new ValidationError(`${human}: question text is required.`)

  const options = Array.isArray(q.options) ? q.options : []
  if (options.length === 0) {
    throw new ValidationError(`${human}: add at least one option.`)
  }

  const seen = new Set<string>()
  const normOptions = options.map((o) => {
    const n = normaliseOption(o, q.category, human)
    if (seen.has(n.value)) {
      throw new ValidationError(`${human}: duplicate option value "${n.value}".`)
    }
    seen.add(n.value)
    return n
  })

  return { id, category: q.category, text, options: normOptions }
}

/**
 * Validate + normalise the whole draft. Enforces unique question ids and that the
 * resulting array is non-empty. Returns the canonical TemplateQuestion[] that the
 * classification engine consumes. Throws ValidationError on any problem.
 */
function normaliseDraft(draft: BuilderDraft): {
  title: string
  questions: TemplateQuestion[]
} {
  const title = (draft.title ?? '').trim()
  if (!title) throw new ValidationError('A template title is required.')

  const list = Array.isArray(draft.questions) ? draft.questions : []
  if (list.length === 0) {
    throw new ValidationError('Add at least one question before saving.')
  }

  const seenIds = new Set<string>()
  const questions = list.map((q, i) => {
    const n = normaliseQuestion(q, i)
    if (seenIds.has(n.id)) {
      throw new ValidationError(`Duplicate question id "${n.id}".`)
    }
    seenIds.add(n.id)
    return n
  })

  // Engine-soundness guard: the engine derives the AUTHORITATIVE Category A from
  // fee bracket + school type, and resolves B from B-question votes. A template
  // with NO Category B question can never resolve a B code (the engine then
  // defaults to the cautious B1 and flags every response). Warn-by-blocking is
  // too strict for demographic/behaviour, but a B axis is structurally required
  // for the module matrix to mean anything, so we require at least one B question.
  if (!questions.some((q) => q.category === 'B')) {
    throw new ValidationError(
      'Add at least one Category B (usage) question — the engine needs it to resolve B1/B2/B3.'
    )
  }

  return { title, questions }
}

/**
 * Parse the JSON draft submitted by the client form. The client serialises the
 * full BuilderDraft into a single hidden field ("draft") to keep the dynamic,
 * nested question/option structure intact across the Server Action boundary.
 */
function parseDraft(formData: FormData): BuilderDraft {
  const raw = formData.get('draft')
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ValidationError('Nothing to save.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ValidationError('Could not read the submitted template.')
  }
  const obj = parsed as Partial<BuilderDraft>
  return {
    title: typeof obj.title === 'string' ? obj.title : '',
    questions: Array.isArray(obj.questions) ? (obj.questions as BuilderQuestion[]) : [],
  }
}

// -----------------------------------------------------------------------------
// Save: publish a NEW template version (version = max + 1, is_active = true) and
// deactivate previous rows. ADMIN / SUPER_ADMIN ONLY.
// -----------------------------------------------------------------------------

export async function saveTemplate(
  formData: FormData
): Promise<BuilderActionResult> {
  const session = await requireRole(ADMIN_ROLES)

  let normalised: { title: string; questions: TemplateQuestion[] }
  try {
    normalised = normaliseDraft(parseDraft(formData))
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.message }
    return { ok: false, error: 'The template could not be validated.' }
  }

  const supabase = await createClient()

  // Next version = current max + 1 (unique(version) guards against collisions).
  const maxVersion = await getMaxTemplateVersion()
  const newVersion = maxVersion + 1

  // 1) Deactivate all currently-active templates so exactly one row stays active.
  //    RLS (qtemplates_admin_write) scopes this to admins. We update by predicate
  //    is_active = true; a no-op (no active rows) is fine on the very first save.
  const { error: deactivateError } = await supabase
    .from('questionnaire_templates')
    .update({ is_active: false })
    .eq('is_active', true)

  if (deactivateError) {
    return { ok: false, error: 'Could not deactivate the previous template version.' }
  }

  // 2) Insert the new active version. questions is the canonical jsonb the engine
  //    reads — unchanged in shape from 0004_seed.sql.
  const { error: insertError } = await supabase
    .from('questionnaire_templates')
    .insert({
      version: newVersion,
      title: normalised.title,
      questions: normalised.questions,
      is_active: true,
      created_by: session.userId,
    })

  if (insertError) {
    // The most likely failure is a version collision (23505) under concurrent
    // saves. Surface a retryable message; the previous active row is already off,
    // so the caller should reload (the builder reloads on success/refresh).
    const code = (insertError as { code?: string }).code
    if (code === '23505') {
      return {
        ok: false,
        error: 'Another save happened at the same time — reload and try again.',
      }
    }
    return { ok: false, error: 'Could not publish the new template version.' }
  }

  // 3) Best-effort: point program_config.active_template_version at the new
  //    version (the documented convention). This requires super_admin
  //    (program_config_super_admin_write); an admin save will fail this RLS check.
  //    The active template is ALSO resolvable via is_active = true (what the
  //    builder reads), so a failure here is a non-fatal WARNING, not an error.
  let warning: string | null = null
  const { error: configError } = await supabase
    .from('program_config')
    .update({ active_template_version: newVersion })
    .eq('id', 1)

  if (configError) {
    warning =
      'Published, but program_config.active_template_version was not updated ' +
      '(requires Super Admin). The new version is active via is_active.'
  }

  revalidatePath('/admin/questionnaires/builder')
  revalidatePath('/super-admin/questionnaires/builder')

  return { ok: true, error: null, newVersion, warning }
}
