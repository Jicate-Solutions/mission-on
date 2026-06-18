'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/feedback/actions.ts — Server Action for learner feedback.
//
// Authorization (learner-only) is enforced inside submitFeedback() in the DAL,
// which re-verifies the session/role on every call — a direct POST is covered.
// The mentor target and learner_public id are resolved server-side from the
// verified session, never trusted from the form.
// =============================================================================

import { revalidatePath } from 'next/cache'

import { submitFeedback } from '@/app/(app)/learner/feedback/feedback-dal'

export interface FeedbackFormState {
  error: string | null
  ok: boolean
}

function toRating(form: FormData, name: string): number | undefined {
  const raw = form.get(name)
  if (raw === null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** useActionState-shaped action: a learner submits feedback / assessment. */
export async function submitFeedbackAction(
  _prev: FeedbackFormState,
  formData: FormData
): Promise<FeedbackFormState> {
  const rating = toRating(formData, 'rating')
  if (rating === undefined) {
    return { error: 'Please give an overall rating from 1 to 5.', ok: false }
  }

  const result = await submitFeedback({
    answers: {
      rating,
      mentorHelpfulness: toRating(formData, 'mentorHelpfulness'),
      sessionImpact: toRating(formData, 'sessionImpact'),
      comment: String(formData.get('comment') ?? ''),
    },
    isAnonymous: formData.get('isAnonymous') === 'on',
  })

  if (!result.ok) {
    return { error: result.error ?? 'Could not submit feedback.', ok: false }
  }
  revalidatePath('/learner/feedback')
  return { error: null, ok: true }
}
