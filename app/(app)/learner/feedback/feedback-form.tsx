'use client'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/feedback/feedback-form.tsx — Client UI for a learner to
// submit feedback / assessment for their session(s).
//
// Submits via the existing submitFeedbackAction Server Action (which re-verifies
// learner role and resolves the mentor target server-side). The learner never
// names or sees anyone's real identity here. 'use client' is needed only for the
// interactive useActionState form.
// =============================================================================

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  submitFeedbackAction,
  type FeedbackFormState,
} from './actions'
import { FEEDBACK_MAX_COMMENT } from './feedback-constants'

const initialState: FeedbackFormState = { error: null, ok: false }

/** A 1-5 radio scale rendered as accessible, tappable pills. */
function RatingScale({
  name,
  label,
  required = false,
  help,
}: {
  name: string
  label: string
  required?: boolean
  help?: string
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>
      {help ? <p className="mb-2 text-xs text-ink-muted">{help}</p> : null}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <label
            key={value}
            className={cn(
              'flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink',
              'transition-colors hover:bg-surface-muted',
              'has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              required={required && value === 1 ? false : undefined}
              className="sr-only"
            />
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function FeedbackForm() {
  const [state, formAction, pending] = useActionState<
    FeedbackFormState,
    FormData
  >(submitFeedbackAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <RatingScale
        name="rating"
        label="Overall, how was your experience?"
        help="1 = not good, 5 = really good."
        required
      />

      <RatingScale
        name="mentorHelpfulness"
        label="How helpful was your mentor?"
        help="Leave blank if you don't have a mentor yet."
      />

      <RatingScale
        name="sessionImpact"
        label="Did this change how you think about your choices?"
        help="1 = not at all, 5 = a lot."
      />

      <div>
        <Label htmlFor="comment">
          Anything you&apos;d like to add? (optional)
        </Label>
        <Textarea
          id="comment"
          name="comment"
          maxLength={FEEDBACK_MAX_COMMENT}
          placeholder="Tell us what helped, or what could be better."
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="isAnonymous"
          className="mt-0.5 h-4 w-4 rounded border-border-strong text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <span>
          Send this anonymously. Your mentor won&apos;t see your name attached to
          it.
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send feedback'}
        </Button>
      </div>
    </form>
  )
}
