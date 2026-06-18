'use client'

import { useActionState, useEffect, useRef } from 'react'

import { raiseBug, type BugFormState } from '@/app/(app)/bug-reports/actions'
import {
  BUG_MAX_DESCRIPTION,
  BUG_MAX_LOGS,
  BUG_MODULES,
} from '@/app/(app)/bug-reports/bug-constants'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const initialState: BugFormState = { error: null, ok: false }

/** Raise-a-bug form. Any role may file; reporter identity is taken server-side. */
export function BugForm() {
  const [state, action, pending] = useActionState(raiseBug, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="bug-module">Which area?</Label>
        <Select id="bug-module" name="module" defaultValue="other">
          {BUG_MODULES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="bug-description" required>
          What went wrong?
        </Label>
        <Textarea
          id="bug-description"
          name="description"
          maxLength={BUG_MAX_DESCRIPTION}
          required
          rows={5}
          placeholder="Describe the problem and what you were doing when it happened."
          aria-invalid={state.error ? true : undefined}
        />
      </div>

      <div>
        <Label htmlFor="bug-logs">Console logs / error (optional)</Label>
        <Textarea
          id="bug-logs"
          name="console_logs"
          maxLength={BUG_MAX_LOGS}
          rows={3}
          placeholder="Paste any error message or browser console output — it helps fix the bug faster."
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-success)_12%,white)] px-3 py-2 text-sm text-success"
        >
          Thanks — your report was submitted. You can track its status below.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit bug report'}
        </Button>
      </div>
    </form>
  )
}
