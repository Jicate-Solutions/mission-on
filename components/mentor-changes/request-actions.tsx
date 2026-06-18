'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
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
import type { MentorPublic } from '@/types/database'

import {
  approveChangeRequest,
  rejectChangeRequest,
  type MentorChangeActionState,
} from './_actions'

const initialState: MentorChangeActionState = { ok: false, error: null }

export interface RequestActionsProps {
  requestId: string
  learnerPublicId: string
  /** mentor_public.id of the current mentor, so we can exclude it from the picker. */
  currentMentorPublicId: string | null
  /** Active mentor aliases available to switch to (alias only — no identity). */
  mentorOptions: MentorPublic[]
}

/**
 * Approve / reject controls for one OPEN mentor-change request. Approving opens
 * a dialog where the admin picks the NEW mentor by ALIAS (the "open the switch"
 * step). Rejecting opens a dialog with an optional note. Both call alias-only
 * Server Actions that re-verify admin internally.
 */
export function RequestActions({
  requestId,
  learnerPublicId,
  currentMentorPublicId,
  mentorOptions,
}: RequestActionsProps) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveChangeRequest,
    initialState
  )
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectChangeRequest,
    initialState
  )
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  // Close each dialog on a NEW successful submit (adjust-state-during-render).
  const [seenApprove, setSeenApprove] = useState(approveState)
  if (seenApprove !== approveState) {
    setSeenApprove(approveState)
    if (approveState.ok && approveOpen) setApproveOpen(false)
  }
  const [seenReject, setSeenReject] = useState(rejectState)
  if (seenReject !== rejectState) {
    setSeenReject(rejectState)
    if (rejectState.ok && rejectOpen) setRejectOpen(false)
  }

  // Exclude the current mentor — switching to the same mentor is a no-op.
  const switchTargets = mentorOptions.filter(
    (m) => m.id !== currentMentorPublicId
  )

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => setApproveOpen(true)}
      >
        Approve &amp; switch
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRejectOpen(true)}
      >
        Reject
      </Button>

      {/* Approve: pick the new mentor by alias, then open the switch. */}
      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)}>
        <DialogClose onClick={() => setApproveOpen(false)} />
        <DialogHeader>
          <DialogTitle>Approve change &amp; switch mentor</DialogTitle>
          <DialogDescription>
            Choose the mentor to switch this learner to. Aliases only — no real
            names are shown. Approving reassigns the learner&apos;s active
            mentor.
          </DialogDescription>
        </DialogHeader>
        <form action={approveAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="learnerPublicId" value={learnerPublicId} />
          <DialogBody>
            <Label htmlFor={`newMentor-${requestId}`} required>
              Switch to mentor
            </Label>
            {switchTargets.length === 0 ? (
              <p className="mt-1 text-sm text-ink-muted">
                No other active mentors are available to switch to.
              </p>
            ) : (
              <Select
                id={`newMentor-${requestId}`}
                name="newMentorPublicId"
                required
                defaultValue=""
                className="mt-1"
              >
                <option value="" disabled>
                  Select a mentor…
                </option>
                {switchTargets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alias}
                  </option>
                ))}
              </Select>
            )}
            {approveState.error ? (
              <p
                role="alert"
                className="mt-2 rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
              >
                {approveState.error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setApproveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={approvePending || switchTargets.length === 0}
            >
              {approvePending ? 'Switching…' : 'Approve & switch'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Reject: close the request without changing the assignment. */}
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)}>
        <DialogClose onClick={() => setRejectOpen(false)} />
        <DialogHeader>
          <DialogTitle>Reject change request</DialogTitle>
          <DialogDescription>
            Rejecting closes the request and keeps the learner&apos;s current
            mentor. You can record a brief internal note.
          </DialogDescription>
        </DialogHeader>
        <form action={rejectAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <DialogBody>
            <Label htmlFor={`rejectNote-${requestId}`}>Note (optional)</Label>
            <Textarea
              id={`rejectNote-${requestId}`}
              name="note"
              rows={3}
              maxLength={4000}
              placeholder="Reason for keeping the current mentor…"
            />
            {rejectState.error ? (
              <p
                role="alert"
                className="mt-2 rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
              >
                {rejectState.error}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={rejectPending}>
              {rejectPending ? 'Rejecting…' : 'Reject request'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
