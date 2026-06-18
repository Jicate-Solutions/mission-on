import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/coordinator/pipeline/_data.ts — Server-only read for the
// coordinator pipeline board (PRD §9.3).
//
// SAFEGUARDING (read before editing):
//   This module is a THIN grouping layer over the shared school-pipeline data
//   layer (app/api/schools/_lib/pipeline.ts). It calls listOwnSchools(), which
//   re-verifies the role and hard-scopes a coordinator to their OWN schools
//   (coordinator_id = self) AND returns the classification-FREE SchoolPipelineRow
//   shape. There is therefore NO classification, no module code, no A/B code on
//   this surface — by construction, not by omission. We do nothing here but
//   bucket those safe rows by pipeline_stage for the board layout.
// =============================================================================

import { listOwnSchools } from '@/app/api/schools/_lib/pipeline'
import type { SchoolPipelineRow } from '@/app/api/schools/_lib/pipeline'
import { PIPELINE_STAGES } from '@/app/api/schools/_lib/pipeline.constants'
import type { PipelineStage } from '@/types/database'

/** One column of the board: a stage plus the coordinator's schools in it. */
export interface PipelineStageColumn {
  stage: PipelineStage
  schools: SchoolPipelineRow[]
}

/** The whole board: every stage (even empty ones) + the total school count. */
export interface PipelineBoard {
  total: number
  columns: PipelineStageColumn[]
}

/**
 * Build the coordinator's pipeline board: their own schools bucketed by
 * pipeline_stage, in the canonical Appendix-A stage order. Empty stages are kept
 * so the board always shows the full pipeline.
 *
 * Auth + self-scope + classification-free shape are all enforced inside
 * listOwnSchools(); this function adds no new data access.
 */
export async function getOwnPipelineBoard(): Promise<PipelineBoard> {
  const schools = await listOwnSchools()

  const byStage = new Map<PipelineStage, SchoolPipelineRow[]>()
  for (const stage of PIPELINE_STAGES) byStage.set(stage, [])
  for (const s of schools) {
    byStage.get(s.pipelineStage)?.push(s)
  }

  return {
    total: schools.length,
    columns: PIPELINE_STAGES.map((stage) => ({
      stage,
      schools: byStage.get(stage) ?? [],
    })),
  }
}
