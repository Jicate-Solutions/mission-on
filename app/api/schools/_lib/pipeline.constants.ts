// =============================================================================
// Mission ON — Smart Choices
// app/api/schools/_lib/pipeline.constants.ts
//
// PURE DATA ONLY — no 'server-only', no Supabase, no secrets. This module is
// safe to import from BOTH Server Components and Client Components (the
// interactive pipeline/session forms need the stage/status maps). It carries
// domain labels + the Appendix-A stage→status rules. It contains NO
// classification data of any kind.
// =============================================================================

import type {
  FeeBracket,
  PipelineStage,
  SchoolStatus,
  SchoolType,
  SessionStatus,
} from '@/types/database'

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  'approach',
  'questionnaire',
  'session_fixing',
  'delivery',
  'follow_up',
] as const

export const STAGE_LABELS: Record<PipelineStage, string> = {
  approach: 'Approach',
  questionnaire: 'Questionnaire',
  session_fixing: 'Session fixing',
  delivery: 'Delivery',
  follow_up: 'Follow-up',
}

/** Appendix A — Pipeline Status Reference: allowed statuses per stage. */
export const STATUSES_BY_STAGE: Record<PipelineStage, readonly SchoolStatus[]> = {
  approach: [
    'not_started',
    'contacted',
    'awaiting_response',
    'declined',
    'approved_to_proceed',
  ],
  questionnaire: ['issued', 'partially_filled', 'completed', 'overdue'],
  session_fixing: ['proposed', 'confirmed', 'rescheduled', 'cancelled'],
  delivery: ['scheduled', 'delivered', 'postponed'],
  follow_up: ['not_started', 'in_progress', 'completed_follow_up'],
}

export const STATUS_LABELS: Record<SchoolStatus, string> = {
  not_started: 'Not started',
  contacted: 'Contacted',
  awaiting_response: 'Awaiting response',
  declined: 'Declined',
  approved_to_proceed: 'Approved to proceed',
  issued: 'Issued',
  partially_filled: 'Partially filled',
  completed: 'Completed',
  overdue: 'Overdue',
  proposed: 'Proposed',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  scheduled: 'Scheduled',
  delivered: 'Delivered',
  postponed: 'Postponed',
  in_progress: 'In progress',
  completed_follow_up: 'Completed',
}

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  private: 'Private',
  government: 'Government',
}

export const FEE_BRACKET_LABELS: Record<FeeBracket, string> = {
  fee_above_1l: 'Private · fees above ₹1L',
  fee_below_1l: 'Private · fees below ₹1L',
  govt: 'Government',
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  proposed: 'Proposed',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  scheduled: 'Scheduled',
  delivered: 'Delivered',
  postponed: 'Postponed',
}

export const SESSION_STATUSES: readonly SessionStatus[] = [
  'proposed',
  'confirmed',
  'rescheduled',
  'cancelled',
  'scheduled',
  'delivered',
  'postponed',
] as const

/** Map a SchoolStatus to a Badge variant for consistent pipeline coloring. */
export function statusVariant(
  status: SchoolStatus
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' {
  switch (status) {
    case 'approved_to_proceed':
    case 'completed':
    case 'confirmed':
    case 'delivered':
    case 'completed_follow_up':
      return 'success'
    case 'declined':
    case 'cancelled':
    case 'overdue':
      return 'danger'
    case 'awaiting_response':
    case 'partially_filled':
    case 'rescheduled':
    case 'postponed':
      return 'warning'
    case 'contacted':
    case 'issued':
    case 'scheduled':
    case 'in_progress':
      return 'info'
    default:
      return 'neutral'
  }
}
