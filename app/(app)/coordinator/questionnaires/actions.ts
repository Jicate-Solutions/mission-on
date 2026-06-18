'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/coordinator/questionnaires/actions.ts
//
// Coordinator questionnaire lifecycle: ISSUE the fixed form to an owned school,
// and CAPTURE the school's responses. On capture, the module is auto-classified
// (PRD §6.5) and the classification is STORED but NEVER returned to the
// coordinator — classification visibility is admin/super_admin only.
//
// SECURITY:
//   - Every action re-verifies session + role (coordinator/admin/super_admin)
//     BEFORE any mutation; a direct POST gets no free pass.
//   - Ownership is re-checked server-side: the acting coordinator must own the
//     school. Admins/super_admins are allowed through for oversight.
//   - Classification (computed_*/confidence/divergence) is written via the
//     service-role admin client into the admin-only questionnaire_classification
//     child table (keyed by response_id) — RLS forbids a coordinator from any
//     access to that table. The function returns ONLY a neutral ok/error to the
//     coordinator, so no module code crosses the boundary.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { verifySession, AuthorizationError } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAdmins } from '@/lib/dal/notify-admins'
import { computeModule } from '@/lib/classification'
import type {
  FeeBracket,
  QuestionnaireAnswers,
  SchoolType,
  TemplateQuestion,
} from '@/types/database'

const COORDINATOR_ROLES = new Set(['coordinator', 'admin', 'super_admin'])

export interface QuestionnaireActionState {
  ok: boolean
  error: string | null
  /** Neutral lifecycle message — never classification. */
  message: string | null
}

const EMPTY: QuestionnaireActionState = { ok: false, error: null, message: null }

/**
 * Re-verify the caller and that they may act on `schoolId`. Coordinators must
 * own the school; admins/super_admins may act on any. Returns the actor userId.
 * Throws AuthorizationError on any failure (mapped to a neutral error by callers).
 */
async function authorizeForSchool(schoolId: string): Promise<{ userId: string }> {
  const session = await verifySession()
  if (!session) throw new AuthorizationError('Not authenticated.', 401)
  if (session.role === null || !COORDINATOR_ROLES.has(session.role)) {
    throw new AuthorizationError('Forbidden.', 403)
  }

  // Ownership / visibility check under RLS: schools SELECT returns the row only
  // if the caller is an admin or owns it. Empty result -> not permitted.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schools')
    .select('id')
    .eq('id', schoolId)
    .maybeSingle()
  if (error || !data) {
    throw new AuthorizationError('You may not act on this school.', 403)
  }
  return { userId: session.userId }
}

function toNeutralError(e: unknown): QuestionnaireActionState {
  if (e instanceof AuthorizationError) {
    return { ok: false, error: 'You are not authorized for this action.', message: null }
  }
  const msg = e instanceof Error ? e.message : 'Something went wrong.'
  return { ok: false, error: msg, message: null }
}

/**
 * ISSUE the active questionnaire to a school (PRD §7.3). Creates (or re-issues)
 * the response row in 'issued' status and stamps issued_at. Idempotent: if a row
 * already exists for (school, template) it is re-stamped to 'issued'.
 */
export async function issueQuestionnaire(
  _prev: QuestionnaireActionState,
  formData: FormData
): Promise<QuestionnaireActionState> {
  const schoolId = String(formData.get('schoolId') ?? '')
  if (!schoolId) return { ...EMPTY, error: 'Missing school id.' }

  try {
    await authorizeForSchool(schoolId)
  } catch (e) {
    return toNeutralError(e)
  }

  const supabase = await createClient()

  // Resolve the active template id.
  const { data: tpl, error: tplError } = await supabase
    .from('questionnaire_templates')
    .select('id')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (tplError || !tpl) {
    return { ...EMPTY, error: 'No active questionnaire template is configured.' }
  }
  const templateId = (tpl as { id: string }).id
  const now = new Date().toISOString()

  // Upsert on (school_id, template_id). Coordinators may insert/update their own
  // school's row (lifecycle only — no classification columns sent here).
  const { error: upsertError } = await supabase
    .from('questionnaire_responses')
    .upsert(
      {
        school_id: schoolId,
        template_id: templateId,
        status: 'issued',
        issued_at: now,
      },
      { onConflict: 'school_id,template_id' }
    )

  if (upsertError) {
    return { ...EMPTY, error: `Failed to issue questionnaire: ${upsertError.message}` }
  }

  // Reflect the pipeline stage/status on the school (Questionnaire stage).
  await supabase
    .from('schools')
    .update({ pipeline_stage: 'questionnaire', status: 'issued' })
    .eq('id', schoolId)

  revalidatePath('/coordinator/questionnaires')
  revalidatePath(`/coordinator/questionnaires/${schoolId}`)
  return { ok: true, error: null, message: 'Questionnaire issued to the school.' }
}

/**
 * Validate that submitted answers only reference known question ids/options of
 * the template, and return a clean answer map. Drops anything unknown.
 */
function sanitizeAnswers(
  questions: TemplateQuestion[],
  raw: FormData
): QuestionnaireAnswers {
  const out: QuestionnaireAnswers = {}
  for (const q of questions) {
    const v = raw.get(`q_${q.id}`)
    if (typeof v !== 'string' || v.length === 0) continue
    const valid = q.options.some((o) => o.value === v)
    if (valid) out[q.id] = v
  }
  return out
}

/**
 * CAPTURE the school's fixed-form answers (PRD §7.3) and AUTO-CLASSIFY.
 *
 * Classification is computed server-side and STORED, but this action returns a
 * neutral lifecycle message only — the coordinator never sees the module code.
 * The classification write uses the service-role client (RLS forbids a
 * coordinator from writing computed_* columns); ownership is re-verified above.
 */
export async function submitQuestionnaireResponses(
  _prev: QuestionnaireActionState,
  formData: FormData
): Promise<QuestionnaireActionState> {
  const schoolId = String(formData.get('schoolId') ?? '')
  if (!schoolId) return { ...EMPTY, error: 'Missing school id.' }

  try {
    await authorizeForSchool(schoolId)
  } catch (e) {
    return toNeutralError(e)
  }

  const supabase = await createClient()

  // Active template (coordinator may read the active template).
  const { data: tplData, error: tplError } = await supabase
    .from('questionnaire_templates')
    .select('id, questions')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (tplError || !tplData) {
    return { ...EMPTY, error: 'No active questionnaire template is configured.' }
  }
  const template = tplData as { id: string; questions: TemplateQuestion[] }
  const questions = template.questions ?? []
  const answers = sanitizeAnswers(questions, formData)

  if (Object.keys(answers).length === 0) {
    return { ...EMPTY, error: 'Please answer at least one question before saving.' }
  }

  // Determine completion: every question answered -> completed, else partial.
  const allAnswered = questions.every((q) => answers[q.id] !== undefined)
  const status = allAnswered ? 'completed' : 'partially_filled'
  const now = new Date().toISOString()

  // --- Write lifecycle (answers/status) under the coordinator's own RLS. ------
  // The coordinator may write answers/status/completed_at for their own school's
  // row. They may NOT write classification columns (RLS check forbids it), so we
  // omit them here entirely.
  const { data: lifecycleRow, error: lifecycleError } = await supabase
    .from('questionnaire_responses')
    .update({
      answers,
      status,
      completed_at: allAnswered ? now : null,
    })
    .eq('school_id', schoolId)
    .eq('template_id', template.id)
    .select('id')
    .maybeSingle()

  if (lifecycleError) {
    return { ...EMPTY, error: `Failed to save responses: ${lifecycleError.message}` }
  }
  const responseId = (lifecycleRow as { id: string } | null)?.id ?? null

  // --- Auto-classify + store via service-role (admin) client. -----------------
  // We need the school's fee bracket + type. Read them with the elevated client
  // (the coordinator never receives the OUTPUT). Then compute and persist the
  // classification into the admin-only questionnaire_classification child table,
  // which the coordinator has NO access to.
  const admin = createAdminClient()
  const { data: schoolRow, error: schoolErr } = await admin
    .from('schools')
    .select('type, fee_bracket')
    .eq('id', schoolId)
    .maybeSingle()

  if (schoolErr || !schoolRow || responseId === null) {
    // Lifecycle saved; classification deferred. Surface a neutral message.
    revalidatePath('/coordinator/questionnaires')
    return {
      ok: true,
      error: null,
      message: 'Responses saved. Classification will be finalised by an admin.',
    }
  }

  const school = schoolRow as { type: SchoolType; fee_bracket: FeeBracket }

  // Only classify once the form is complete (a partial form would mis-score).
  if (allAnswered) {
    const result = computeModule({
      feeBracket: school.fee_bracket,
      schoolType: school.type,
      questions,
      answers,
    })

    // Upsert the classification child keyed by response_id (unique). This never
    // touches the confirmed_* fields — those are set only on admin confirm.
    const { error: classifyError } = await admin
      .from('questionnaire_classification')
      .upsert(
        {
          response_id: responseId,
          computed_a_code: result.computed_a_code,
          computed_b_code: result.computed_b_code,
          computed_module_code: result.computed_module_code,
          confidence: result.confidence,
          divergence_flag: result.divergence_flag,
        },
        { onConflict: 'response_id' }
      )

    if (classifyError) {
      // Do not leak classification detail to the coordinator on failure either.
      revalidatePath('/coordinator/questionnaires')
      return {
        ok: true,
        error: null,
        message: 'Responses saved. Classification will be finalised by an admin.',
      }
    }

    // Alert the triage owners that a school is classified and ready for module
    // design (PRD §7.11). Recipients are admin/super_admin (classification
    // visibility holders); we still keep the payload free of the module code and
    // only flag whether manual confirmation is needed.
    const { data: schoolNameRow } = await admin
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .maybeSingle()
    const schoolName = (schoolNameRow as { name: string } | null)?.name ?? 'A school'
    await notifyAdmins({
      type: 'questionnaire',
      title: `${schoolName}: questionnaire complete`,
      body: result.divergence_flag
        ? `${schoolName} is classified but FLAGGED — confirm the module code before module design.`
        : `${schoolName} is classified and ready for module design.`,
      entityType: 'schools',
      entityId: schoolId,
    })
  }

  revalidatePath('/coordinator/questionnaires')
  revalidatePath(`/coordinator/questionnaires/${schoolId}`)
  return {
    ok: true,
    error: null,
    message: allAnswered
      ? 'Responses captured. The questionnaire is complete.'
      : 'Partial responses saved.',
  }
}
