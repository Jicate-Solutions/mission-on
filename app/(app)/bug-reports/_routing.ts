import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/bug-reports/_routing.ts — bug-report notification routing.
//
// When any role raises a bug, the triage owners (admin + super_admin) get an
// in-app notification so reports are not "lost" between raise and triage
// (PRD §7.11). Delegates to the shared lib/dal/notify-admins helper (service-role
// fan-out to admins) — the reporter is usually NOT an admin, so the notifications
// INSERT must run with elevated context. No reporter identity is in the payload —
// only the bug's id/display_id.
// =============================================================================

import { notifyAdmins } from '@/lib/dal/notify-admins'

/**
 * Notify the triage owners that a new bug was raised. Best-effort: a notification
 * failure must NOT roll back the bug itself (handled inside notifyAdmins).
 */
export async function notifyTriageOfNewBug(input: {
  bugId: string
  displayId: string | null
  reporterRole: string
}): Promise<void> {
  const label = input.displayId ?? 'A new bug'
  await notifyAdmins({
    type: 'bug_report_new',
    title: `${label} reported`,
    body: `A ${input.reporterRole} raised a new bug report. Open the queue to triage it.`,
    entityType: 'bug_reports',
    entityId: input.bugId,
  })
}
