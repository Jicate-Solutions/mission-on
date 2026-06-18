'use client'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/admin/learners/change-request-review.tsx — Admin UI to approve
// (optionally reassigning a mentor) or reject one mentor-change request.
//
// ALIAS-ONLY: receives learner alias, current mentor alias, and the available
// mentor aliases to reassign to. No real identity crosses this boundary.
// Submits to the approve/reject Server Actions, which re-verify admin role.
// =============================================================================

import { useActionState } from 'react'

import type { MentorPublic } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  approveChangeRequest,
  rejectChangeRequest,
  initialAdminActionState,
  type AdminActionState,
} from './actions'

export interface ChangeRequestReviewProps {
  requestId: string
  /** Active mentor aliases available to reassign to. */
  mentors: MentorPublic[]
  /** The learner's current mentor alias id (excluded as a pointless pick). */
  currentMentorPublicId: string | null
}

export function ChangeRequestReview({
  requestId,
  mentors,
  currentMentorPublicId,
}: ChangeRequestReviewProps) {
  const [approveState, approveAction, approvePending] = useActionState<
    AdminActionState,
    FormData
  >(approveChangeRequest, initialAdminActionState)
  const [rejectState, rejectAction, rejectPending] = useActionState<
    AdminActionState,
    FormData
  >(rejectChangeRequest, initialAdminActionState)

  const selectable = mentors.filter((m) => m.id !== currentMentorPublicId)
  const message =
    approveState.error ??
    approveState.success ??
    rejectState.error ??
    rejectState.success ??
    null
  const isError = Boolean(approveState.error ?? rejectState.error)

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p
          role={isError ? 'alert' : 'status'}
          aria-live="polite"
          className={
            isError
              ? 'rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger'
              : 'rounded-md bg-[color-mix(in_srgb,var(--color-success)_12%,white)] px-3 py-2 text-sm text-success'
          }
        >
          {message}
        </p>
      ) : null}

      <form action={approveAction} className="flex flex-col gap-2">
        <input type="hidden" name="requestId" value={requestId} />
        <div>
          <Label htmlFor={`mentor-${requestId}`}>
            Reassign to (optional)
          </Label>
          <Select
            id={`mentor-${requestId}`}
            name="newMentorPublicId"
            defaultValue=""
          >
            <option value="">Leave unassigned — learner re-picks</option>
            {selectable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.alias}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={approvePending}>
            {approvePending ? 'Approving…' : 'Approve'}
          </Button>
        </div>
      </form>

      <form action={rejectAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={rejectPending}
        >
          {rejectPending ? 'Rejecting…' : 'Reject'}
        </Button>
      </form>
    </div>
  )
}
