'use client'

// Stage + status updater. Shared by coordinator and admin school detail views.
// Submits the updateStageAction Server Action (which re-verifies auth + scope).

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  updateStageAction,
  type ActionResult,
} from '@/app/api/schools/_lib/actions'
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  STATUSES_BY_STAGE,
  STATUS_LABELS,
} from '@/app/api/schools/_lib/pipeline.constants'
import type { PipelineStage, SchoolStatus } from '@/types/database'

const initial: ActionResult = { ok: false, error: null }

export function StageForm({
  schoolId,
  currentStage,
  currentStatus,
}: {
  schoolId: string
  currentStage: PipelineStage
  currentStatus: SchoolStatus
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    updateStageAction,
    initial
  )
  const [stage, setStage] = useState<PipelineStage>(currentStage)
  const [status, setStatus] = useState<string>(currentStatus)

  // When the stage changes, default the status to the first valid one for it.
  function onStageChange(next: PipelineStage) {
    setStage(next)
    const allowed = STATUSES_BY_STAGE[next]
    setStatus(
      (allowed as readonly string[]).includes(status) ? status : allowed[0]
    )
  }

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  const allowedStatuses = STATUSES_BY_STAGE[stage]

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="school_id" value={schoolId} />

      <div>
        <Label htmlFor="pipeline_stage">Stage</Label>
        <Select
          id="pipeline_stage"
          name="pipeline_stage"
          value={stage}
          onChange={(e) => onStageChange(e.target.value as PipelineStage)}
        >
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {allowedStatuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-success" role="status">
          Pipeline updated.
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Update pipeline'}
      </Button>
    </form>
  )
}
