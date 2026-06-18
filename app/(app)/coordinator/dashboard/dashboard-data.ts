import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/coordinator/dashboard/dashboard-data.ts — Aggregate reads for the
// coordinator home dashboard.
//
// SAFEGUARDING (read before editing):
//   A coordinator sees ONLY their own schools (RLS schools_select scopes rows to
//   coordinator_id = auth.uid()) and NEVER any classification (no module codes,
//   no A/B codes) — those columns live on questionnaire_responses, which a
//   coordinator can only reach via the classification-free coordinator VIEW.
//   This file deliberately touches NEITHER questionnaire_responses NOR any
//   classification column; it reports schools-by-stage and a status breakdown.
//
//   Re-verifies the coordinator/admin/super_admin role internally.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type { PipelineStage, SchoolStatus } from '@/types/database'

export interface CoordinatorSchoolSummary {
  id: string
  name: string
  stage: PipelineStage
  status: SchoolStatus
}

export interface CoordinatorOverview {
  totalSchools: number
  stageCounts: { stage: PipelineStage; count: number }[]
  /** A short, current list of the coordinator's schools (no classification). */
  schools: CoordinatorSchoolSummary[]
}

const ALL_STAGES: PipelineStage[] = [
  'approach',
  'questionnaire',
  'session_fixing',
  'delivery',
  'follow_up',
]

export async function getCoordinatorOverview(): Promise<CoordinatorOverview> {
  // Admins may view too (oversight); RLS still scopes coordinator rows to self.
  await requireRole(['coordinator', 'admin', 'super_admin'])
  const supabase = await createClient()

  // RLS returns only this coordinator's schools. No classification columns are
  // selected — only logistics/lifecycle.
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, pipeline_stage, status')
    .order('updated_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as {
    id: string
    name: string
    pipeline_stage: PipelineStage
    status: SchoolStatus
  }[]

  const stageTally = new Map<PipelineStage, number>()
  for (const row of rows) {
    stageTally.set(
      row.pipeline_stage,
      (stageTally.get(row.pipeline_stage) ?? 0) + 1
    )
  }

  return {
    totalSchools: rows.length,
    stageCounts: ALL_STAGES.map((stage) => ({
      stage,
      count: stageTally.get(stage) ?? 0,
    })),
    schools: rows.slice(0, 8).map((r) => ({
      id: r.id,
      name: r.name,
      stage: r.pipeline_stage,
      status: r.status,
    })),
  }
}
