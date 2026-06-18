'use client'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/mentors/mentor-picker.tsx — Client UI for a learner to
// browse mentors BY ALIAS and choose one.
//
// This component receives ONLY alias-shaped data (MentorPublic: id, alias,
// is_active). It cannot render a real name because no real-name field exists on
// its props — the compile-time half of the identity split. Submission goes to
// the chooseMentor Server Action, which re-verifies the learner role.
// =============================================================================

import { useActionState } from 'react'

import type { MentorPublic } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  chooseMentor,
  initialActionState,
  type ActionState,
} from './actions'

export interface MentorPickerProps {
  mentors: MentorPublic[]
  /** The learner's currently chosen mentor alias id, if any. */
  chosenMentorId: string | null
  /** When true, a change request is pending — choosing is locked. */
  locked: boolean
}

export function MentorPicker({
  mentors,
  chosenMentorId,
  locked,
}: MentorPickerProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    chooseMentor,
    initialActionState
  )

  if (mentors.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-ink-muted">
          No mentors are available to choose right now. Please check back soon.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
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

      {locked ? (
        <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted">
          A mentor change you asked for is being reviewed by an admin. You cannot
          change mentor until they respond.
        </p>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mentors.map((mentor) => {
          const isChosen = mentor.id === chosenMentorId
          // Once a mentor is chosen, others are not directly selectable —
          // switching is admin-mediated via the change-request flow.
          const otherWhileChosen = Boolean(chosenMentorId) && !isChosen
          return (
            <li key={mentor.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-3 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold text-ink">
                      {mentor.alias}
                    </span>
                    {isChosen ? (
                      <Badge variant="brand">Your mentor</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-ink-muted">
                    A trained mentor you can talk to in confidence.
                  </p>
                  <form action={formAction} className="mt-auto">
                    <input
                      type="hidden"
                      name="mentorPublicId"
                      value={mentor.id}
                    />
                    <Button
                      type="submit"
                      variant={isChosen ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full"
                      disabled={pending || locked || isChosen || otherWhileChosen}
                    >
                      {isChosen
                        ? 'Selected'
                        : otherWhileChosen
                          ? 'Ask admin to switch'
                          : pending
                            ? 'Saving…'
                            : 'Choose this mentor'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
