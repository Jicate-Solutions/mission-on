'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
// (useEffect is used only for the imperative DOM form reset — no setState in it.)

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { createLog, type ActionState } from './_actions'
import type { AssignedLearner } from './_data'

const initialState: ActionState = { ok: false, error: null }

export interface LogFormProps {
  learners: AssignedLearner[]
}

/**
 * Mentor follow-through log form. Alias-only learner picker. A safeguarding flag
 * reveals a required reason field; flagging routes the case to the safeguarding
 * lead via the Server Action (the mentor never sees admin internals).
 */
export function LogForm({ learners }: LogFormProps) {
  const [state, formAction, pending] = useActionState(createLog, initialState)
  const [flagged, setFlagged] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const reasonId = useId()
  const [seen, setSeen] = useState(state)

  // On a NEW successful save, clear the controlled checkbox during render
  // (adjust-state-during-render pattern: track last-seen state in state).
  if (seen !== state) {
    setSeen(state)
    if (state.ok && state.createdLogId && flagged) setFlagged(false)
  }

  // Imperative DOM reset of the uncontrolled fields after that same save. This
  // is a genuine external-system sync (the <form> element), so it lives in an
  // effect — and it performs NO React setState.
  useEffect(() => {
    if (state.ok && state.createdLogId) {
      formRef.current?.reset()
    }
  }, [state])

  if (learners.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        You have no learners assigned yet. Once a learner chooses you, you can
        log follow-through here.
      </p>
    )
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="learnerPublicId" required>
          Learner
        </Label>
        <Select id="learnerPublicId" name="learnerPublicId" required defaultValue="">
          <option value="" disabled>
            Select a learner…
          </option>
          {learners.map((l) => (
            <option key={l.learnerPublicId} value={l.learnerPublicId}>
              {l.alias}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-ink-muted">
          Learners are shown by alias to protect their identity.
        </p>
      </div>

      <div>
        <Label htmlFor="notes" required>
          Follow-through notes
        </Label>
        <Textarea
          id="notes"
          name="notes"
          required
          rows={5}
          maxLength={5000}
          placeholder="What you discussed, how the learner is doing, next steps…"
        />
        <p className="mt-1 text-xs text-ink-muted">
          These notes are confidential to you unless a safeguarding escalation is
          raised.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface-muted/50 p-3">
        <label className="flex items-start gap-3 text-sm">
          <Input
            type="checkbox"
            name="flagSafeguarding"
            className="mt-0.5 h-4 w-4"
            checked={flagged}
            onChange={(e) => setFlagged(e.target.checked)}
            aria-controls={reasonId}
          />
          <span>
            <span className="font-medium text-ink">
              Flag for safeguarding review
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              Use only for immediate danger, suicidal ideation, abuse, or
              coercion. This routes the case to the safeguarding lead.
            </span>
          </span>
        </label>

        {flagged ? (
          <div id={reasonId} className="mt-3">
            <Label htmlFor="reason" required>
              Reason for escalation
            </Label>
            <Textarea
              id="reason"
              name="reason"
              required={flagged}
              rows={3}
              maxLength={2000}
              placeholder="Briefly, why this needs safeguarding attention."
            />
          </div>
        ) : null}
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

      {state.ok && state.createdLogId ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-success)_12%,white)] px-3 py-2 text-sm text-success"
        >
          Follow-through saved
          {flagged ? ' and escalated for safeguarding review.' : '.'}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Saving…' : 'Save follow-through'}
      </Button>
    </form>
  )
}
