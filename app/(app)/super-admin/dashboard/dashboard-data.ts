import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/super-admin/dashboard/dashboard-data.ts — Aggregate-only reads for
// the super_admin home dashboard.
//
// SAFEGUARDING (read before editing):
//   This file produces AGGREGATES ONLY (counts and code distributions). It
//   never returns raw confidential rows, never surfaces a learner's real
//   identity, and never joins real-identity tables. Module-code distribution is
//   admin/super_admin-visible per the RBAC matrix, and is read here as a COUNT
//   per code, not as per-school rows tied to anything identifying.
//
//   The function re-verifies role internally (requireRole) — defense against a
//   direct invocation. All queries run under the RLS-scoped SSR client. Counts
//   use head:true so NO rows cross the wire — only the count.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type {
  ModuleCode,
  PipelineStage,
  EscalationStatus,
} from '@/types/database'

export interface SuperAdminOverview {
  totalSchools: number
  schoolsClassified: number
  openEscalations: number
  openBugs: number
  hiddenAnonPosts: number
  openMentorChanges: number
  /** Pipeline stage -> count of schools in that stage. */
  stageCounts: { stage: PipelineStage; count: number }[]
  /** Confirmed module code -> count of schools. */
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

const ACTIVE_ESCALATION: EscalationStatus[] = ['open', 'acknowledged']

export async function getSuperAdminOverview(): Promise<SuperAdminOverview> {
  await requireRole(['super_admin'])
  const supabase = await createClient()

  // Aggregate counts (head:true -> no rows transferred, count only).
  const [
    totalSchools,
    openEscalations,
    openBugs,
    hiddenAnonPosts,
    openMentorChanges,
    stageRes,
    moduleRes,
  ] = await Promise.all([
    supabase.from('schools').select('id', { count: 'exact', head: true }),
    supabase
      .from('safeguarding_escalations')
      .select('id', { count: 'exact', head: true })
      .in('status', ACTIVE_ESCALATION),
    supabase
      .from('bug_reports')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'triaged', 'assigned']),
    supabase
      .from('anonymous_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_hidden', true),
    supabase
      .from('mentor_change_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase.from('schools').select('pipeline_stage'),
    supabase
      .from('questionnaire_classification')
      .select('confirmed_module_code')
      .not('confirmed_module_code', 'is', null),
  ])

  const labelled: [string, { error: unknown }][] = [
    ['schools.count', totalSchools],
    ['escalations.count', openEscalations],
    ['bugs.count', openBugs],
    ['anon.count', hiddenAnonPosts],
    ['mentorChanges.count', openMentorChanges],
    ['schools.stages', stageRes],
    ['questionnaire_classification', moduleRes],
  ]
  for (const [label, r] of labelled) {
    const err = r.error as
      | { message?: string; code?: string; details?: string; hint?: string }
      | null
    if (err) {
      throw new Error(
        `getSuperAdminOverview failed at [${label}]: ${
          err.message || '(no message)'
        }${err.code ? ` code=${err.code}` : ''}${
          err.details ? ` details=${err.details}` : ''
        }${err.hint ? ` hint=${err.hint}` : ''}`
      )
    }
  }

  // Schools per pipeline stage.
  const stageTally = new Map<PipelineStage, number>()
  for (const row of stageRes.data ?? []) {
    const s = row.pipeline_stage as PipelineStage
    stageTally.set(s, (stageTally.get(s) ?? 0) + 1)
  }
  const stageCounts = ALL_STAGES.map((stage) => ({
    stage,
    count: stageTally.get(stage) ?? 0,
  }))

  // Module-code distribution from confirmed classifications (admin-visible).
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
    schoolsClassified: (moduleRes.data ?? []).length,
    openEscalations: openEscalations.count ?? 0,
    openBugs: openBugs.count ?? 0,
    hiddenAnonPosts: hiddenAnonPosts.count ?? 0,
    openMentorChanges: openMentorChanges.count ?? 0,
    stageCounts,
    moduleCounts,
  }
}
