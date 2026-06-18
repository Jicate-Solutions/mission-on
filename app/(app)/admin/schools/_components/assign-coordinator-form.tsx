'use client'

// Admin reassign-coordinator form for an existing school. Submits
// assignCoordinatorAction (admin/super_admin re-verified server-side).

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  assignCoordinatorAction,
  type ActionResult,
} from '@/app/api/schools/_lib/actions'
import type { CoordinatorChoice } from './create-school-form'

const initial: ActionResult = { ok: false, error: null }

export function AssignCoordinatorForm({
  schoolId,
  currentCoordinatorId,
  coordinators,
}: {
  schoolId: string
  currentCoordinatorId: string | null
  coordinators: CoordinatorChoice[]
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    assignCoordinatorAction,
    initial
  )

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="school_id" value={schoolId} />
      <div>
        <Label htmlFor="assign_coordinator_id">Coordinator</Label>
        <Select
          id="assign_coordinator_id"
          name="coordinator_id"
          defaultValue={currentCoordinatorId ?? ''}
        >
          <option value="">— Unassigned —</option>
          {coordinators.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.label}
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
          Coordinator updated.
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Save coordinator'}
      </Button>
    </form>
  )
}
