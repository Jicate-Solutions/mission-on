'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/api/schools/_lib/actions.ts — Server Actions for the school-pipeline.
//
// Every action here is reachable by a DIRECT POST, so EACH delegates to a
// pipeline.ts helper that re-verifies session + role internally (the page gate
// is NOT the authorization boundary). Inputs are parsed defensively and
// validated against the domain enums before any write.
//
// These return a small ActionResult discriminated shape consumed by the client
// forms (useActionState-friendly). On success we revalidate the affected paths.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { AuthorizationError } from '@/lib/dal'
import type { SessionStatus } from '@/types/database'
import {
  assignCoordinator,
  createSchool,
  createSessionLogistics,
  isFeeBracket,
  isPipelineStage,
  isSchoolType,
  isSessionStatus,
  isStatusValidForStage,
  updateSchoolStage,
  updateSessionLogistics,
} from './pipeline'

export interface ActionResult {
  ok: boolean
  error: string | null
  /** Optional created/updated id, for client redirect. */
  id?: string
}

const OK: ActionResult = { ok: true, error: null }
function fail(error: string): ActionResult {
  return { ok: false, error }
}

/** Map any thrown error to a safe, non-leaking ActionResult. */
function toResult(e: unknown): ActionResult {
  if (e instanceof AuthorizationError) {
    return fail(
      e.status === 401
        ? 'You are not signed in.'
        : 'You are not allowed to do that.'
    )
  }
  // Do not surface raw DB errors to the client; log for ops.
  console.error('[schools action] error:', e)
  return fail('Something went wrong. Please try again.')
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}
function nullableStr(v: FormDataEntryValue | null): string | null {
  const s = str(v)
  return s.length === 0 ? null : s
}

// -----------------------------------------------------------------------------
// Admin: create a school (+ optional coordinator assignment).
// -----------------------------------------------------------------------------
export async function createSchoolAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const name = str(formData.get('name'))
    const type = formData.get('type')
    const feeBracket = formData.get('fee_bracket')
    const coordinatorRaw = nullableStr(formData.get('coordinator_id'))

    if (name.length < 2) return fail('School name is required.')
    if (!isSchoolType(type)) return fail('Choose a valid school type.')
    if (!isFeeBracket(feeBracket)) return fail('Choose a valid fee bracket.')

    const { id } = await createSchool({
      name,
      type,
      feeBracket,
      coordinatorId: coordinatorRaw,
    })

    revalidatePath('/admin/schools')
    return { ...OK, id }
  } catch (e) {
    return toResult(e)
  }
}

// -----------------------------------------------------------------------------
// Admin: (re)assign a school's coordinator.
// -----------------------------------------------------------------------------
export async function assignCoordinatorAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const schoolId = str(formData.get('school_id'))
    const coordinatorId = nullableStr(formData.get('coordinator_id'))
    if (!schoolId) return fail('Missing school.')

    await assignCoordinator(schoolId, coordinatorId)

    revalidatePath('/admin/schools')
    revalidatePath(`/admin/schools/${schoolId}`)
    return OK
  } catch (e) {
    return toResult(e)
  }
}

// -----------------------------------------------------------------------------
// Coordinator/Admin: update a school's pipeline stage + status.
// -----------------------------------------------------------------------------
export async function updateStageAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const schoolId = str(formData.get('school_id'))
    const stage = formData.get('pipeline_stage')
    const status = formData.get('status')

    if (!schoolId) return fail('Missing school.')
    if (!isPipelineStage(stage)) return fail('Choose a valid stage.')
    if (!isStatusValidForStage(stage, status)) {
      return fail('That status is not valid for the chosen stage.')
    }

    await updateSchoolStage(schoolId, stage, status)

    revalidatePath('/coordinator/schools')
    revalidatePath(`/coordinator/schools/${schoolId}`)
    revalidatePath('/admin/schools')
    revalidatePath(`/admin/schools/${schoolId}`)
    return OK
  } catch (e) {
    return toResult(e)
  }
}

// -----------------------------------------------------------------------------
// Coordinator/Admin: capture / update session logistics for a school.
// -----------------------------------------------------------------------------
function parseSessionInput(formData: FormData):
  | {
      ok: true
      value: {
        grade: string
        sessionDate: string | null
        dayOfWeek: string | null
        startTime: string | null
        expectedStrength: number | null
        status: SessionStatus
      }
    }
  | { ok: false; error: string } {
  const grade = str(formData.get('grade'))
  if (grade.length === 0) return { ok: false, error: 'Grade is required.' }

  const status = formData.get('status')
  if (!isSessionStatus(status)) {
    return { ok: false, error: 'Choose a valid session status.' }
  }

  const expectedRaw = str(formData.get('expected_strength'))
  let expectedStrength: number | null = null
  if (expectedRaw.length > 0) {
    const n = Number(expectedRaw)
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { ok: false, error: 'Expected strength must be a whole number.' }
    }
    expectedStrength = n
  }

  return {
    ok: true,
    value: {
      grade,
      sessionDate: nullableStr(formData.get('session_date')),
      dayOfWeek: nullableStr(formData.get('day_of_week')),
      startTime: nullableStr(formData.get('start_time')),
      expectedStrength,
      status,
    },
  }
}

export async function saveSessionLogisticsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const schoolId = str(formData.get('school_id'))
    if (!schoolId) return fail('Missing school.')

    const parsed = parseSessionInput(formData)
    if (!parsed.ok) return fail(parsed.error)

    const sessionId = nullableStr(formData.get('session_id'))
    if (sessionId) {
      await updateSessionLogistics(schoolId, sessionId, parsed.value)
    } else {
      await createSessionLogistics(schoolId, parsed.value)
    }

    revalidatePath('/coordinator/schools')
    revalidatePath(`/coordinator/schools/${schoolId}`)
    revalidatePath('/admin/schools')
    revalidatePath(`/admin/schools/${schoolId}`)
    return OK
  } catch (e) {
    return toResult(e)
  }
}
