// =============================================================================
// Mission ON — Smart Choices
// app/(app)/bug-reports/bug-constants.ts
//
// PLAIN DATA shared by the server DAL and client forms (no 'server-only').
// =============================================================================

import type { BugStatus, BugSeverity } from '@/types/database'

export const BUG_MAX_DESCRIPTION = 2000
export const BUG_MAX_RESOLUTION = 2000
export const BUG_MAX_LOGS = 8000

/**
 * Mission ON feature modules — the reporter tags which area the bug is in so the
 * Bug Agent export can group/dispatch by module (mirrors the nav feature areas).
 */
export const BUG_MODULES = [
  'schools',
  'questionnaires',
  'classification',
  'module-design',
  'mentors',
  'learners',
  'follow-through',
  'safeguarding',
  'feedback',
  'anonymous-chat',
  'bug-reports',
  'roles',
  'auth',
  'dashboard',
  'other',
] as const
export type BugModule = (typeof BUG_MODULES)[number]

export function isBugModule(v: unknown): v is BugModule {
  return typeof v === 'string' && (BUG_MODULES as readonly string[]).includes(v)
}

/** Bug Agent severity scale (admin-assigned during triage). */
export const BUG_SEVERITIES: readonly BugSeverity[] = [
  'P0',
  'P1',
  'P2',
  'P3',
] as const

export const BUG_SEVERITY_LABEL: Record<BugSeverity, string> = {
  P0: 'P0 — Critical',
  P1: 'P1 — High',
  P2: 'P2 — Medium',
  P3: 'P3 — Low',
}

export function isBugSeverity(v: unknown): v is BugSeverity {
  return typeof v === 'string' && (BUG_SEVERITIES as readonly string[]).includes(v)
}

/** Ordered statuses for the triage workflow. */
export const BUG_STATUSES: readonly BugStatus[] = [
  'open',
  'triaged',
  'assigned',
  'resolved',
  'closed',
] as const

/** Human labels for each status. */
export const BUG_STATUS_LABEL: Record<BugStatus, string> = {
  open: 'Open',
  triaged: 'Triaged',
  assigned: 'Assigned',
  resolved: 'Resolved',
  closed: 'Closed',
}

/** Badge variant per status (for the reporter-visible status pill). */
export const BUG_STATUS_VARIANT: Record<
  BugStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'brand'
> = {
  open: 'warning',
  triaged: 'info',
  assigned: 'brand',
  resolved: 'success',
  closed: 'neutral',
}
