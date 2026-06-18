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
import {
  acknowledgeEscalation,
  resolveEscalation,
  type QueueActionState,
} from './_actions'

const initialState: QueueActionState = { ok: false, error: null }

export interface CaseActionsProps {
  escalationId: string
  status: 'open' | 'acknowledged' | 'resolved'
}

/**
 * Acknowledge / resolve controls for one safeguarding case. Acknowledge is a
 * direct action; resolve opens a dialog requiring a resolution note (audited).
 */
export function CaseActions({ escalationId, status }: CaseActionsProps) {
  const [ackState, ackAction, ackPending] = useActionState(
    acknowledgeEscalation,
    initialState
  )
  const [resolveState, resolveActionFn, resolvePending] = useActionState(
    resolveEscalation,
    initialState
  )
  const [resolveOpen, setResolveOpen] = useState(false)

  // Close the resolve dialog on a NEW successful resolve. Adjust-state-during-
  // render pattern: track last-seen state in state, act once on change.
  const [seenResolve, setSeenResolve] = useState(resolveState)
  if (seenResolve !== resolveState) {
    setSeenResolve(resolveState)
    if (resolveState.ok && resolveOpen) setResolveOpen(false)
  }

  if (status === 'resolved') {
    return <span className="text-xs text-ink-muted">Closed</span>
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {status === 'open' ? (
        <form action={ackAction}>
          <input type="hidden" name="escalationId" value={escalationId} />
          <Button type="submit" variant="outline" size="sm" disabled={ackPending}>
            {ackPending ? 'Acknowledging…' : 'Acknowledge'}
          </Button>
        </form>
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setResolveOpen(true)}
      >
        Resolve
      </Button>

      {ackState.error ? (
        <span className="text-xs text-danger">{ackState.error}</span>
      ) : null}

      <Dialog open={resolveOpen} onClose={() => setResolveOpen(false)}>
        <DialogClose onClick={() => setResolveOpen(false)} />
        <DialogHeader>
          <DialogTitle>Resolve safeguarding case</DialogTitle>
          <DialogDescription>
            Resolving closes the case and ends the identity reveal for the
            mentor. Record what was done.
          </DialogDescription>
        </DialogHeader>
        <form action={resolveActionFn}>
          <input type="hidden" name="escalationId" value={escalationId} />
          <DialogBody>
            <Label htmlFor={`auditNotes-${escalationId}`} required>
              Resolution note
            </Label>
            <Textarea
              id={`auditNotes-${escalationId}`}
              name="auditNotes"
              required
              rows={4}
              maxLength={4000}
              placeholder="Action taken, referral made, follow-up arranged…"
            />
            {resolveState.error ? (
              <p
                role="alert"
                className="mt-2 rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
              >
                {resolveState.error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResolveOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={resolvePending}>
              {resolvePending ? 'Resolving…' : 'Resolve case'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
