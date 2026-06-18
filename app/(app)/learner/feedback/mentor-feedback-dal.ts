import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/feedback/mentor-feedback-dal.ts — module-local server-only
// read for a MENTOR viewing feedback that targets THEIR OWN alias (PRD §7.8,
// §11, §12).
//
// The canonical feedback-dal.ts deliberately does NOT serve the mentor view
// ("handled in the mentor's own pages, not here"). This sibling file provides
// exactly that read, following the same DAL discipline:
//   - import 'server-only'
//   - re-verify role (mentor) on every call
//   - return alias-only DTOs
//
// IDENTITY DISCIPLINE (Ring 1, PRD §12):
//   - Mentors read feedback ONLY through the mentor_feedback_v security-definer
//     view (migration 0009). The view self-restricts to feedback targeting the
//     caller's own mentor alias (auth.uid()), and it NEVER exposes
//     learner_public_id — it returns the learner alias for non-anonymous rows
//     and NULL for anonymous ones. This makes anonymity real at the DATA layer,
//     not just in this DTO: a mentor cannot recover an anonymous submitter even
//     via a raw query, because the base-table RLS no longer grants mentors any
//     direct SELECT on feedback_responses (see 0009).
//   - We NEVER join learner_profiles / mentor_profiles. No real name is reachable.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/dal'
import type { FeedbackResponseRow, Json } from '@/types/database'
import type { FeedbackAnswers } from './feedback-dal'

/** One feedback item as the receiving mentor sees it — alias-first. */
export interface MentorFeedbackView {
  id: string
  answers: FeedbackAnswers
  /**
   * The submitting learner's ALIAS, or null when the feedback was left
   * anonymously. NEVER a real name.
   */
  learnerAlias: string | null
  isAnonymous: boolean
  createdAt: string
}

function parseAnswers(responses: Json): FeedbackAnswers {
  const r = (responses ?? {}) as Record<string, unknown>
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  return {
    rating: num(r.rating) ?? 0,
    mentorHelpfulness: num(r.mentorHelpfulness),
    sessionImpact: num(r.sessionImpact),
    comment: typeof r.comment === 'string' ? r.comment : undefined,
  }
}

/**
 * List feedback that targets the calling mentor's own alias, newest first.
 * Mentor role only (re-verified). Reads the mentor_feedback_v security-definer
 * view, which self-scopes to the caller and already nulls learner_alias for
 * anonymous rows — so anonymity holds even against a raw query, not just here.
 */
export async function listFeedbackForMentor(): Promise<MentorFeedbackView[]> {
  await requireRole(['mentor'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mentor_feedback_v')
    .select('id, responses, is_anonymous, created_at, learner_alias')
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as unknown as Array<
    Pick<
      FeedbackResponseRow,
      'id' | 'responses' | 'is_anonymous' | 'created_at'
    > & { learner_alias: string | null }
  >

  return rows.map((row) => ({
    id: row.id,
    answers: parseAnswers(row.responses),
    // The view already returns null for anonymous rows; this is a belt-and-braces
    // guard so the DTO can never carry an alias for an anonymous submission.
    learnerAlias: row.is_anonymous ? null : row.learner_alias,
    isAnonymous: row.is_anonymous,
    createdAt: row.created_at,
  }))
}
