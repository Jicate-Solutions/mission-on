import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/dashboard/dashboard-data.ts — Aggregate-only reads for the
// admin home dashboard.
//
// SAFEGUARDING (read before editing):
//   AGGREGATES ONLY — counts and stage/code distributions. No raw confidential
//   rows, no real-identity joins, no per-learner data. Classification module
//   codes are admin-visible per the RBAC matrix and read here only as counts.
//   Feedback is aggregated to a total + anonymous share, never per-learner.
//
//   Re-verifies admin/super_admin internally. Counts use head:true so no rows
//   cross the wire.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type { ModuleCode, PipelineStage } from '@/types/database'

export interface AdminOverview {
  totalSchools: number
  /** Schools with a confirmed module code. */
  classifiedSchools: number
  /** Responses flagged divergent and awaiting admin confirmation. */
  divergencePending: number
  openMentorChanges: number
  openBugs: number
  feedbackTotal: number
  feedbackAnonymous: number
  stageCounts: { stage: PipelineStage; count: number }[]
  moduleCounts: { code: ModuleCode; count: number }[]
}

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

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireRole(['admin', 'super_admin'])
  const supabase = await createClient()

  const [
    totalSchools,
    divergencePending,
    openMentorChanges,
    openBugs,
    feedbackTotal,
    feedbackAnonymous,
    stageRes,
    moduleRes,
  ] = await Promise.all([
    supabase.from('schools').select('id', { count: 'exact', head: true }),
    supabase
      .from('questionnaire_classification')
      .select('id', { count: 'exact', head: true })
      .eq('divergence_flag', true)
      .is('confirmed_module_code', null),
    supabase
      .from('mentor_change_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('bug_reports')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'triaged', 'assigned']),
    supabase
      .from('feedback_responses')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('feedback_responses')
      .select('id', { count: 'exact', head: true })
      .eq('is_anonymous', true),
    supabase.from('schools').select('pipeline_stage'),
    supabase
      .from('questionnaire_classification')
      .select('confirmed_module_code')
      .not('confirmed_module_code', 'is', null),
  ])

  for (const r of [
    totalSchools,
    divergencePending,
    openMentorChanges,
    openBugs,
    feedbackTotal,
    feedbackAnonymous,
    stageRes,
    moduleRes,
  ]) {
    if (r.error) throw r.error
  }

  const stageTally = new Map<PipelineStage, number>()
  for (const row of stageRes.data ?? []) {
    const s = row.pipeline_stage as PipelineStage
    stageTally.set(s, (stageTally.get(s) ?? 0) + 1)
  }
  const stageCounts = ALL_STAGES.map((stage) => ({
    stage,
    count: stageTally.get(stage) ?? 0,
  }))

  const moduleTally = new Map<ModuleCode, number>()
  for (const row of moduleRes.data ?? []) {
    const c = row.confirmed_module_code as ModuleCode | null
    if (c) moduleTally.set(c, (moduleTally.get(c) ?? 0) + 1)
  }
  const moduleCounts = ALL_MODULE_CODES.map((code) => ({
    code,
    count: moduleTally.get(code) ?? 0,
  })).filter((m) => m.count > 0)

  return {
    totalSchools: totalSchools.count ?? 0,
    classifiedSchools: (moduleRes.data ?? []).length,
    divergencePending: divergencePending.count ?? 0,
    openMentorChanges: openMentorChanges.count ?? 0,
    openBugs: openBugs.count ?? 0,
    feedbackTotal: feedbackTotal.count ?? 0,
    feedbackAnonymous: feedbackAnonymous.count ?? 0,
    stageCounts,
    moduleCounts,
  }
}
