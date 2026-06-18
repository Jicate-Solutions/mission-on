// =============================================================================
// Mission ON — Smart Choices
// components/dashboard/labels.ts — Human-readable labels for enum values used in
// dashboard widgets. Plain data (no 'use client' / 'server-only') so both server
// pages and client widgets may import it.
// =============================================================================

import type {
  PipelineStage,
  SchoolStatus,
  LearnerAssignmentStatus,
} from '@/types/database'

export const STAGE_LABEL: Record<PipelineStage, string> = {
  approach: 'Approach',
  questionnaire: 'Questionnaire',
  session_fixing: 'Session fixing',
  delivery: 'Delivery',
  follow_up: 'Follow-up',
}

export const SCHOOL_STATUS_LABEL: Record<SchoolStatus, string> = {
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
  completed_follow_up: 'Follow-up complete',
}

export const ASSIGNMENT_STATUS_LABEL: Record<LearnerAssignmentStatus, string> = {
  active: 'Active',
  pending_change: 'Change pending',
  reassigned: 'Reassigned',
  ended: 'Ended',
}
