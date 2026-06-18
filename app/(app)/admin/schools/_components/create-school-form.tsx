'use client'

// Admin create-school form (+ optional coordinator assignment). Submits
// createSchoolAction (admin/super_admin re-verified server-side). On success it
// navigates to the new school's pipeline detail page.

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  createSchoolAction,
  type ActionResult,
} from '@/app/api/schools/_lib/actions'
import {
  FEE_BRACKET_LABELS,
  SCHOOL_TYPE_LABELS,
} from '@/app/api/schools/_lib/pipeline.constants'

const initial: ActionResult = { ok: false, error: null }

export interface CoordinatorChoice {
  userId: string
  label: string
}

export function CreateSchoolForm({
  coordinators,
  /**
   * Role-namespaced base path for the post-create redirect, WITHOUT a trailing
   * slash (e.g. '/admin/schools' or '/super-admin/schools'). Defaults to the
   * admin namespace so existing admin usage is unchanged.
   */
  basePath = '/admin/schools',
}: {
  coordinators: CoordinatorChoice[]
  basePath?: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    createSchoolAction,
    initial
  )

  useEffect(() => {
    if (state.ok && state.id) {
      router.push(`${basePath}/${state.id}`)
    }
  }, [state.ok, state.id, router, basePath])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="name" required>
          School name
        </Label>
        <Input id="name" name="name" required placeholder="School name" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="type" required>
            School type
          </Label>
          <Select id="type" name="type" defaultValue="private">
            {(Object.keys(SCHOOL_TYPE_LABELS) as Array<
              keyof typeof SCHOOL_TYPE_LABELS
            >).map((t) => (
              <option key={t} value={t}>
                {SCHOOL_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="fee_bracket" required>
            Fee bracket
          </Label>
          <Select
            id="fee_bracket"
            name="fee_bracket"
            defaultValue="fee_above_1l"
          >
            {(Object.keys(FEE_BRACKET_LABELS) as Array<
              keyof typeof FEE_BRACKET_LABELS
            >).map((f) => (
              <option key={f} value={f}>
                {FEE_BRACKET_LABELS[f]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="coordinator_id">Assign coordinator</Label>
        <Select id="coordinator_id" name="coordinator_id" defaultValue="">
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

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Creating…' : 'Create school'}
      </Button>
    </form>
  )
}
