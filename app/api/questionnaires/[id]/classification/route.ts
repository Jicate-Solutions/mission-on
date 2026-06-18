// =============================================================================
// Mission ON — Smart Choices
// app/api/questionnaires/[id]/classification/route.ts
//
// ADMIN / SUPER_ADMIN ONLY classification API (PRD §6, §7.3). This is the
// API-layer counterpart of the admin classification pages: it is the ONLY
// questionnaire endpoint that emits a computed/confirmed module code, and it is
// gated to admins at the handler. Coordinators use /api/questionnaires (the
// classification-free lifecycle endpoint) instead.
//
// Next.js 16 Route Handlers are NOT cached and are reachable by a DIRECT
// request, so EVERY method re-verifies session + role internally — a page gate
// does not protect this. Reads write a `classification.read` audit; confirms
// write a `classification.confirm` audit. Audit goes through the DAL
// (service-role RPC); clients cannot forge entries.
// =============================================================================

import { NextResponse } from 'next/server'

import { requireRole, writeAudit, AuthorizationError } from '@/lib/dal'
import { getAdminQuestionnaireDetail } from '@/app/(app)/admin/questionnaires/_data'
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

function isModuleCode(value: unknown): value is ModuleCode {
  return typeof value === 'string' && (MODULE_CODES as string[]).includes(value)
}

function authError(e: unknown): Response | null {
  if (e instanceof AuthorizationError) {
    return NextResponse.json(
      { error: e.status === 401 ? 'Unauthenticated.' : 'Forbidden.' },
      { status: e.status }
    )
  }
  return null
}

/**
 * GET /api/questionnaires/:id/classification
 * Returns the full classification detail for one response (computed/confirmed
 * module code, A/B codes, confidence, divergence, raw answers). ADMIN-ONLY.
 * Writes a `classification.read` audit on each actual read.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  try {
    await requireRole(ADMIN_ROLES)
  } catch (e) {
    const mapped = authError(e)
    if (mapped) return mapped
    throw e
  }

  try {
    const detail = await getAdminQuestionnaireDetail(id)
    if (!detail) {
      return NextResponse.json(
        { error: 'Questionnaire response not found.' },
        { status: 404 }
      )
    }

    await writeAudit({
      action: 'classification.read',
      entityType: 'questionnaire_responses',
      entityId: detail.id,
      metadata: {
        school_id: detail.schoolId,
        computed_module_code: detail.computedModuleCode,
        confirmed_module_code: detail.confirmedModuleCode,
        via: 'api',
      },
    })

    return NextResponse.json(
      { data: detail },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    const mapped = authError(e)
    if (mapped) return mapped
    const message = e instanceof Error ? e.message : 'Unexpected error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/questionnaires/:id/classification
 * Confirm (lock) the module code for a response — accept the computed code or
 * override it after resolving a divergence flag (PRD §6.4). ADMIN-ONLY. Sets
 * confirmed_module_code / confirmed_by / confirmed_at, status -> 'confirmed',
 * clears divergence, and writes a `classification.confirm` audit.
 *
 * Body: { moduleCode: ModuleCode }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  let session
  try {
    session = await requireRole(ADMIN_ROLES)
  } catch (e) {
    const mapped = authError(e)
    if (mapped) return mapped
    throw e
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const moduleCode = (body as { moduleCode?: unknown } | null)?.moduleCode
  if (!isModuleCode(moduleCode)) {
    return NextResponse.json(
      { error: 'Provide a valid moduleCode (A1-B1 … A3-B3).' },
      { status: 400 }
    )
  }

  try {
    const supabase = await createClient()

    // Re-read the parent (admin-only) to confirm the row exists and capture the
    // prior lifecycle status for the audit.
    const { data: existing, error: readError } = await supabase
      .from('questionnaire_responses')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (readError) {
      return NextResponse.json(
        { error: `Could not load the response: ${readError.message}` },
        { status: 500 }
      )
    }
    if (!existing) {
      return NextResponse.json(
        { error: 'Questionnaire response not found.' },
        { status: 404 }
      )
    }

    // Prior computed state from the admin-only classification child (audit only).
    const { data: priorClass } = await supabase
      .from('questionnaire_classification')
      .select('computed_module_code, divergence_flag')
      .eq('response_id', id)
      .maybeSingle()

    const now = new Date().toISOString()

    // Confirm on the admin-only classification child (upsert keyed by response_id
    // so a confirm still works if auto-classify never ran).
    const { error: classifyError } = await supabase
      .from('questionnaire_classification')
      .upsert(
        {
          response_id: id,
          confirmed_module_code: moduleCode,
          confirmed_by: session.userId,
          confirmed_at: now,
          divergence_flag: false,
        },
        { onConflict: 'response_id' }
      )

    if (classifyError) {
      return NextResponse.json(
        { error: `Failed to confirm: ${classifyError.message}` },
        { status: 500 }
      )
    }

    // Move the parent's lifecycle status -> 'confirmed' (classification-free).
    const { error: updateError } = await supabase
      .from('questionnaire_responses')
      .update({ status: 'confirmed' })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to confirm: ${updateError.message}` },
        { status: 500 }
      )
    }

    await writeAudit({
      action: 'classification.confirm',
      entityType: 'questionnaire_responses',
      entityId: id,
      metadata: {
        confirmed_module_code: moduleCode,
        computed_module_code: priorClass?.computed_module_code ?? null,
        overrode_computed:
          (priorClass?.computed_module_code ?? null) !== null &&
          priorClass?.computed_module_code !== moduleCode,
        previous_status: existing.status,
        resolved_divergence: priorClass?.divergence_flag ?? false,
        via: 'api',
      },
    })

    return NextResponse.json(
      { data: { id, confirmedModuleCode: moduleCode, confirmedAt: now } },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    const mapped = authError(e)
    if (mapped) return mapped
    const message = e instanceof Error ? e.message : 'Unexpected error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
