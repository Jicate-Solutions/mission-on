'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/bug-reports/actions.ts — Server Actions for the bug report system.
//
// Authorization lives in the DAL functions (each re-verifies session/role). A
// direct POST to these actions still hits those checks. These wrappers shape
// input/output and revalidate the page.
// =============================================================================

import { revalidatePath } from 'next/cache'

import {
  createBugReport,
  triageBugReport,
} from '@/app/(app)/bug-reports/bug-dal'
import { requireRole } from '@/lib/dal'
import type { BugStatus } from '@/types/database'

export interface BugFormState {
  error: string | null
  ok: boolean
}

/** useActionState-shaped action: any role raises a bug. */
export async function raiseBug(
  _prev: BugFormState,
  formData: FormData
): Promise<BugFormState> {
  const description = String(formData.get('description') ?? '')
  const module = String(formData.get('module') ?? '') || null
  const consoleLogs = String(formData.get('console_logs') ?? '') || null
  const result = await createBugReport(description, { module, consoleLogs })
  if (!result.ok) {
    return { error: result.error ?? 'Could not submit.', ok: false }
  }
  revalidatePath('/bug-reports')
  return { error: null, ok: true }
}

/**
 * Admin triage: update status / assignee / resolution. Admin/super_admin only
 * (enforced in triageBugReport). Plain form action (no useActionState).
 */
export async function triageBug(formData: FormData): Promise<void> {
  // Re-verify here so we can resolve the admin's id for self-assignment. The DAL
  // re-verifies again (defense in depth).
  const session = await requireRole(['admin', 'super_admin'])

  const bugId = String(formData.get('bugId') ?? '')
  if (!bugId) return

  const statusRaw = formData.get('status')
  const resolutionRaw = formData.get('resolution')
  const severityRaw = formData.get('severity')
  const assignRaw = String(formData.get('assign') ?? '') // 'self' | 'clear' | ''

  let assigneeId: string | null | undefined
  if (assignRaw === 'self') assigneeId = session.userId
  else if (assignRaw === 'clear') assigneeId = null
  else assigneeId = undefined

  await triageBugReport({
    bugId,
    status: statusRaw ? (String(statusRaw) as BugStatus) : undefined,
    resolution: resolutionRaw !== null ? String(resolutionRaw) : undefined,
    severity: severityRaw !== null ? String(severityRaw) : undefined,
    assigneeId,
  })

  revalidatePath('/bug-reports')
}
