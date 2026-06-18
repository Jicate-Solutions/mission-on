'use client'

// Session-logistics capture form (grade / date / day / time / expected
// strength / status). Shared by coordinator and admin school detail views.
// Submits saveSessionLogisticsAction (re-verifies auth + ownership server-side).
// NO module-code field exists here, by design — coordinators never design modules.

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  saveSessionLogisticsAction,
  type ActionResult,
} from '@/app/api/schools/_lib/actions'
import {
  SESSION_STATUSES,
  SESSION_STATUS_LABELS,
} from '@/app/api/schools/_lib/pipeline.constants'
import type { SessionStatus } from '@/types/database'

const initial: ActionResult = { ok: false, error: null }

export interface SessionFormDefaults {
  sessionId?: string
  grade?: string
  sessionDate?: string | null
  dayOfWeek?: string | null
  startTime?: string | null
  expectedStrength?: number | null
  status?: SessionStatus
}

export function SessionForm({
  schoolId,
  defaults,
  onSaved,
}: {
  schoolId: string
  defaults?: SessionFormDefaults
  onSaved?: () => void
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    saveSessionLogisticsAction,
    initial
  )

  useEffect(() => {
    if (state.ok) {
      router.refresh()
      onSaved?.()
    }
  }, [state.ok, router, onSaved])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="school_id" value={schoolId} />
      {defaults?.sessionId ? (
        <input type="hidden" name="session_id" value={defaults.sessionId} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="grade" required>
            Grade
          </Label>
          <Input
            id="grade"
            name="grade"
            required
            defaultValue={defaults?.grade ?? ''}
            placeholder="e.g. Grade 9"
          />
        </div>
        <div>
          <Label htmlFor="expected_strength">Expected strength</Label>
          <Input
            id="expected_strength"
            name="expected_strength"
            type="number"
            min={0}
            step={1}
            defaultValue={defaults?.expectedStrength ?? ''}
            placeholder="e.g. 120"
          />
        </div>
        <div>
          <Label htmlFor="session_date">Date</Label>
          <Input
            id="session_date"
            name="session_date"
            type="date"
            defaultValue={defaults?.sessionDate ?? ''}
          />
        </div>
        <div>
          <Label htmlFor="day_of_week">Day</Label>
          <Input
            id="day_of_week"
            name="day_of_week"
            defaultValue={defaults?.dayOfWeek ?? ''}
            placeholder="e.g. Wednesday"
          />
        </div>
        <div>
          <Label htmlFor="start_time">Time</Label>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            defaultValue={defaults?.startTime ?? ''}
          />
        </div>
        <div>
          <Label htmlFor="session_status">Status</Label>
          <Select
            id="session_status"
            name="status"
            defaultValue={defaults?.status ?? 'proposed'}
          >
            {SESSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SESSION_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-success" role="status">
          Session logistics saved.
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? 'Saving…'
          : defaults?.sessionId
            ? 'Update session'
            : 'Add session'}
      </Button>
    </form>
  )
}
