'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/questionnaires/actions.ts — Admin classification actions.
//
// A Server Action is reachable by a DIRECT POST; a page-level gate does NOT
// protect it. EVERY action here re-verifies session + role internally via
// requireRole(['admin','super_admin']) BEFORE touching data, and writes an audit
// entry through the DAL writeAudit() (service-role RPC). The confirmed_* fields
// live on the admin-only questionnaire_classification child table (0006), whose
// qclass_admin_all RLS policy restricts the write to admins; the response's
// status -> 'confirmed' lifecycle flag is updated on the parent.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { requireRole, writeAudit, AuthorizationError } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type { ModuleCode } from '@/types/database'

const ADMIN_ROLES = ['admin', 'super_admin'] as const

const MODULE_CODES: readonly ModuleCode[] = [
  'A1-B1',
  'A1-B2',
  'A1-B3',
  'A2-B1',
  'A2-B2',
  'A2-B3',
  'A3-B1',
  'A3-B2',
  'A3-B3',
]

export interface ConfirmModuleState {
  ok: boolean
  error: string | null
}

function isModuleCode(value: unknown): value is ModuleCode {
  return typeof value === 'string' && (MODULE_CODES as string[]).includes(value)
}

/**
 * Confirm (lock) the module code for a questionnaire response. The admin may
 * accept the computed code or OVERRIDE it (e.g. after resolving a divergence
 * flag, PRD §6.4). Sets confirmed_module_code / confirmed_by / confirmed_at and
 * moves status -> 'confirmed'. useActionState-shaped.
 */
export async function confirmModuleCode(
  _prev: ConfirmModuleState,
  formData: FormData
): Promise<ConfirmModuleState> {
  let session
  try {
    session = await requireRole(ADMIN_ROLES)
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return { ok: false, error: 'You are not authorized to confirm classifications.' }
    }
    throw e
  }

  const responseId = String(formData.get('responseId') ?? '')
  const moduleCode = formData.get('moduleCode')

  if (!responseId) {
    return { ok: false, error: 'Missing questionnaire response id.' }
  }
  if (!isModuleCode(moduleCode)) {
    return { ok: false, error: 'Select a valid module code (A1-B1 … A3-B3).' }
  }

  const supabase = await createClient()

  // Re-read the parent (admins only) to confirm the row exists and capture the
  // prior lifecycle status for the audit.
  const { data: existing, error: readError } = await supabase
    .from('questionnaire_responses')
    .select('id, status')
    .eq('id', responseId)
    .maybeSingle()

  if (readError) {
    return { ok: false, error: `Could not load the response: ${readError.message}` }
  }
  if (!existing) {
    return { ok: false, error: 'Questionnaire response not found.' }
  }

  // Re-read the admin-only classification child (if any) for prior computed
  // state — used only for the audit (override detection / divergence resolution).
  const { data: priorClass } = await supabase
    .from('questionnaire_classification')
    .select('computed_module_code, divergence_flag')
    .eq('response_id', responseId)
    .maybeSingle()

  const now = new Date().toISOString()

  // Confirm the module on the admin-only classification child. Upsert keyed by
  // response_id so a confirm still works if auto-classify never ran.
  const { error: classifyError } = await supabase
    .from('questionnaire_classification')
    .upsert(
      {
        response_id: responseId,
        confirmed_module_code: moduleCode,
        confirmed_by: session.userId,
        confirmed_at: now,
        // Once an admin has confirmed, the divergence is resolved.
        divergence_flag: false,
      },
      { onConflict: 'response_id' }
    )

  if (classifyError) {
    return { ok: false, error: `Failed to confirm: ${classifyError.message}` }
  }

  // Move the parent's lifecycle status -> 'confirmed' (classification-free).
  const { error: updateError } = await supabase
    .from('questionnaire_responses')
    .update({ status: 'confirmed' })
    .eq('id', responseId)

  if (updateError) {
    return { ok: false, error: `Failed to confirm: ${updateError.message}` }
  }

  // Audit the confirmation (and whether it overrode the computed code).
  await writeAudit({
    action: 'classification.confirm',
    entityType: 'questionnaire_responses',
    entityId: responseId,
    metadata: {
      confirmed_module_code: moduleCode,
      computed_module_code: priorClass?.computed_module_code ?? null,
      overrode_computed:
        (priorClass?.computed_module_code ?? null) !== null &&
        priorClass?.computed_module_code !== moduleCode,
      previous_status: existing.status,
      resolved_divergence: priorClass?.divergence_flag ?? false,
    },
  })

  revalidatePath('/admin/questionnaires')
  revalidatePath(`/admin/questionnaires/${responseId}`)
  return { ok: true, error: null }
}
