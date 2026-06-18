'use client'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/mentors/change-request-form.tsx — Client UI for a learner to
// raise a mentor-change request (escalates to Admin). Alias-only context; the
// learner never types or sees a real name.
// =============================================================================

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  requestMentorChange,
  initialActionState,
  type ActionState,
} from './actions'

export interface ChangeRequestFormProps {
  /** The current mentor's alias, for display only. */
  currentMentorAlias: string
  /** True when an open request already exists (button disabled). */
  hasOpenRequest: boolean
}

export function ChangeRequestForm({
  currentMentorAlias,
  hasOpenRequest,
}: ChangeRequestFormProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestMentorChange,
    initialActionState
  )

  return (
    <div className="flex flex-col gap-2">
      {hasOpenRequest ? (
        <Badge variant="warning">Change request pending review</Badge>
      ) : null}

      {state.success ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-success)_12%,white)] px-3 py-2 text-sm text-success"
        >
          {state.success}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={hasOpenRequest}
      >
        Ask to change mentor
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="change-mentor-title"
        describedBy="change-mentor-desc"
      >
        <DialogClose onClick={() => setOpen(false)} />
        <DialogHeader>
          <DialogTitle id="change-mentor-title">Ask to change mentor</DialogTitle>
          <DialogDescription id="change-mentor-desc">
            Your current mentor is {currentMentorAlias}. An admin will review your
            request and help you switch. You can tell us why if you want to — it is
            optional.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <DialogBody className="flex flex-col gap-3">
            {state.error ? (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
              >
                {state.error}
              </p>
            ) : null}
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                name="reason"
                maxLength={1000}
                placeholder="You don't have to share details if you'd rather not."
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Sending…' : 'Send request'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}
