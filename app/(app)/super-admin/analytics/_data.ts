import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/super-admin/analytics/_data.ts — Program-wide analytics aggregates
// (PRD §9.1 Super Admin dashboard, §3 success metrics, §15 Phase 5).
//
// SAFEGUARDING (read before editing — PRD §12, Ring 2):
//   This file produces AGGREGATES ONLY. Only anonymized, aggregate data crosses
//   here — never an individual's identity. It returns counts, rates, code
//   distributions and averages. It NEVER returns raw confidential rows, never
//   surfaces a learner's or mentor's real identity, and never joins a real-
//   identity table (learner_profiles / mentor_profiles). Engagement counts read
//   the ALIAS tables (mentor_public / learner_public) only. Module-code
//   distribution is admin/super_admin-visible per the RBAC matrix and is read as
//   a COUNT per code, not as per-school rows tied to anything identifying.
//
//   SUPER_ADMIN ONLY. Every exported function re-verifies the role
//   (requireRole(['super_admin'])) before any query — defense against a direct
//   invocation. All queries run under the RLS-scoped SSR client. Count queries
//   use head:true so NO rows cross the wire — only the count.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type {
  ModuleCode,
  PipelineStage,
  EscalationStatus,
  BugStatus,
} from '@/types/database'

// -----------------------------------------------------------------------------
// DTO
// -----------------------------------------------------------------------------

export interface ProgramAnalytics {
  /** Pipeline throughput: schools per pipeline stage. */
  stageCounts: { stage: PipelineStage; count: number }[]
  /** Total schools across all stages (sum of stageCounts). */
  totalSchools: number

  /** §3 success metric — follow-up completion. */
  followUp: {
    /** Schools that have reached the follow-up stage. */
    reached: number
    /** Of those, how many have completed the follow-up. */
    completed: number
    /** completed / reached, 0..100 (null when none have reached follow-up). */
    completionRate: number | null
  }

  /** Module-code distribution (confirmed, falling back to computed). */
  moduleCounts: { code: ModuleCode; count: number }[]
  /** Classifications with a confirmed code. */
  confirmedClassifications: number
  /** Classifications counted by computed code as a fallback (no confirmed yet). */
  computedFallbacks: number

  /** Feedback (anonymized): total responses + average overall rating. */
  feedback: {
    total: number
    averageRating: number | null
  }

  /** Safeguarding escalations by status. */
  safeguarding: { status: EscalationStatus; count: number }[]
  /** Bug reports by status. */
  bugs: { status: BugStatus; count: number }[]

  /** Engagement (alias tables + active assignments — no real identity). */
  engagement: {
    mentors: number
    learners: number
    activeAssignments: number
  }
}

// -----------------------------------------------------------------------------
// Enum value lists (kept here so output is stable & ordered, mirroring the
// dashboard-data convention).
// -----------------------------------------------------------------------------

const ALL_STAGES: PipelineStage[] = [
  'approach',
  'questionnaire',
  'session_fixing',
  'delivery',
  'follow_up',
]

const ALL_MODULE_CODES: ModuleCode[] = [
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

const ALL_ESCALATION_STATUSES: EscalationStatus[] = [
  'open',
  'acknowledged',
  'resolved',
]

const ALL_BUG_STATUSES: BugStatus[] = [
  'open',
  'triaged',
  'assigned',
  'resolved',
  'closed',
]

/** Average a 1-5 rating out of a feedback `responses` jsonb blob. */
function ratingOf(responses: unknown): number | null {
  const r = (responses ?? {}) as Record<string, unknown>
  const v = r.rating
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 5
    ? v
    : null
}

/**
 * Program-wide, anonymized analytics for the Super Admin (PRD §9.1 / §15 Phase
 * 5). Super_admin only — re-verified before any query. Returns aggregates only.
 */
export async function getProgramAnalytics(): Promise<ProgramAnalytics> {
  await requireRole(['super_admin'])
  const supabase = await createClient()

  const [
    stageRes,
    moduleRes,
    feedbackTotal,
    feedbackRatings,
    safeguardRes,
    bugRes,
    mentors,
    learners,
    activeAssignments,
  ] = await Promise.all([
    // Pipeline throughput — stage + status per school (cheap: two enum columns).
    supabase.from('schools').select('pipeline_stage, status'),
    // Module distribution — confirmed first, computed as fallback.
    supabase
      .from('questionnaire_classification')
      .select('confirmed_module_code, computed_module_code'),
    // Feedback total (count only — head:true, no rows cross the wire).
    supabase
      .from('feedback_responses')
      .select('id', { count: 'exact', head: true }),
    // Feedback ratings — responses jsonb only (no identity columns).
    supabase.from('feedback_responses').select('responses'),
    // Safeguarding escalations — status only.
    supabase.from('safeguarding_escalations').select('status'),
    // Bug reports — status only.
    supabase.from('bug_reports').select('status'),
    // Engagement — alias tables + active assignments (no real identity).
    supabase.from('mentor_public').select('id', { count: 'exact', head: true }),
    supabase.from('learner_public').select('id', { count: 'exact', head: true }),
    supabase
      .from('learner_mentor_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
  ])

  const labelled: [string, { error: unknown }][] = [
    ['schools.stage_status', stageRes],
    ['questionnaire_classification', moduleRes],
    ['feedback.count', feedbackTotal],
    ['feedback.ratings', feedbackRatings],
    ['safeguarding.status', safeguardRes],
    ['bugs.status', bugRes],
    ['mentor_public.count', mentors],
    ['learner_public.count', learners],
    ['assignments.active', activeAssignments],
  ]
  for (const [label, r] of labelled) {
    const err = r.error as
      | { message?: string; code?: string; details?: string; hint?: string }
      | null
    if (err) {
      throw new Error(
        `getProgramAnalytics failed at [${label}]: ${
          err.message || '(no message)'
        }${err.code ? ` code=${err.code}` : ''}${
          err.details ? ` details=${err.details}` : ''
        }${err.hint ? ` hint=${err.hint}` : ''}`
      )
    }
  }

  // ---- Pipeline throughput + follow-up completion (§3) -----------------------
  const stageTally = new Map<PipelineStage, number>()
  let followReached = 0
  let followCompleted = 0
  const schoolRows = (stageRes.data ?? []) as {
    pipeline_stage: PipelineStage
    status: string
  }[]
  for (const row of schoolRows) {
    stageTally.set(
      row.pipeline_stage,
      (stageTally.get(row.pipeline_stage) ?? 0) + 1
    )
    if (row.pipeline_stage === 'follow_up') {
      followReached += 1
      if (row.status === 'completed_follow_up') followCompleted += 1
    }
  }
  const stageCounts = ALL_STAGES.map((stage) => ({
    stage,
    count: stageTally.get(stage) ?? 0,
  }))
  const completionRate =
    followReached > 0
      ? Math.round((followCompleted / followReached) * 1000) / 10
      : null

  // ---- Module-code distribution (confirmed, computed fallback) ---------------
  const moduleTally = new Map<ModuleCode, number>()
  let confirmedClassifications = 0
  let computedFallbacks = 0
  const classRows = (moduleRes.data ?? []) as {
    confirmed_module_code: ModuleCode | null
    computed_module_code: ModuleCode | null
  }[]
  for (const row of classRows) {
    const code = row.confirmed_module_code ?? row.computed_module_code
    if (!code) continue
    moduleTally.set(code, (moduleTally.get(code) ?? 0) + 1)
    if (row.confirmed_module_code) confirmedClassifications += 1
    else computedFallbacks += 1
  }
  const moduleCounts = ALL_MODULE_CODES.map((code) => ({
    code,
    count: moduleTally.get(code) ?? 0,
  })).filter((m) => m.count > 0)

  // ---- Feedback average ------------------------------------------------------
  let ratingSum = 0
  let ratingCount = 0
  for (const row of (feedbackRatings.data ?? []) as { responses: unknown }[]) {
    const v = ratingOf(row.responses)
    if (v !== null) {
      ratingSum += v
      ratingCount += 1
    }
  }
  const averageRating =
    ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 100) / 100 : null

  // ---- Safeguarding + bugs by status ----------------------------------------
  const safeTally = new Map<EscalationStatus, number>()
  for (const row of (safeguardRes.data ?? []) as { status: EscalationStatus }[]) {
    safeTally.set(row.status, (safeTally.get(row.status) ?? 0) + 1)
  }
  const safeguarding = ALL_ESCALATION_STATUSES.map((status) => ({
    status,
    count: safeTally.get(status) ?? 0,
  }))

  const bugTally = new Map<BugStatus, number>()
  for (const row of (bugRes.data ?? []) as { status: BugStatus }[]) {
    bugTally.set(row.status, (bugTally.get(row.status) ?? 0) + 1)
  }
  const bugs = ALL_BUG_STATUSES.map((status) => ({
    status,
    count: bugTally.get(status) ?? 0,
  }))

  return {
    stageCounts,
    totalSchools: schoolRows.length,
    followUp: {
      reached: followReached,
      completed: followCompleted,
      completionRate,
    },
    moduleCounts,
    confirmedClassifications,
    computedFallbacks,
    feedback: {
      total: feedbackTotal.count ?? 0,
      averageRating,
    },
    safeguarding,
    bugs,
    engagement: {
      mentors: mentors.count ?? 0,
      learners: learners.count ?? 0,
      activeAssignments: activeAssignments.count ?? 0,
    },
  }
}
