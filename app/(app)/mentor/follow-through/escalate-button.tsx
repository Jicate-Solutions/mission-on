'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { escalateExistingLog, type ActionState } from './_actions'

const initialState: ActionState = { ok: false, error: null }

export interface EscalateButtonProps {
  logId: string
  learnerAlias: string
}

/**
 * Raise a safeguarding escalation on an existing (already-saved) follow-through
 * log. Opens a dialog requiring a reason, then routes to the safeguarding lead.
 */
export function EscalateButton({ logId, learnerAlias }: EscalateButtonProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    escalateExistingLog,
    initialState
  )

  // Close the dialog on a NEW successful escalation. React's "adjust state
  // during render" pattern: track the last-seen action state in state and act
  // once when it changes — no effect, no ref.
  const [seen, setSeen] = useState(state)
  if (seen !== state) {
    setSeen(state)
    if (state.ok && open) setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Escalate
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle>Escalate for safeguarding</DialogTitle>
          <DialogDescription>
            This routes the case for {learnerAlias} to the safeguarding lead.
            Use only for genuine risk.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="logId" value={logId} />
          <DialogBody>
            <Label htmlFor={`reason-${logId}`} required>
              Reason for escalation
            </Label>
            <Textarea
              id={`reason-${logId}`}
              name="reason"
              required
              rows={3}
              maxLength={2000}
              placeholder="Briefly, why this needs safeguarding attention."
            />
            {state.error ? (
              <p
                role="alert"
                className="mt-2 rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
              >
                {state.error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? 'Escalating…' : 'Raise escalation'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}
