import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/learner/feedback/feedback-dal.ts — module-local server-only data
// access for feedback + assessment (PRD §7.8, §11).
//
// Visibility (enforced by RLS, re-checked here):
//   - Learner: submits own feedback; views own.
//   - Mentor: views feedback that targets THEIR alias (own learners' feedback)
//     — handled in the mentor's own pages, not here.
//   - Admin/super_admin: view AGGREGATE only (count + averaged ratings). We do
//     NOT expose per-learner identity to admins on this path; the aggregate is
//     anonymized (Ring 2, PRD §12).
//
// ALIAS DISCIPLINE: feedback_responses references learner_public_id and
// mentor_public_id — ALIAS-table ids only. This module NEVER joins
// learner_profiles or mentor_profiles. No real identity is reachable here.
//
// Every function re-verifies session + role internally. The learner's
// learner_public_id and their active mentor's mentor_public_id are resolved
// server-side from the verified session — never trusted from caller input.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { requireSession, requireRole } from '@/lib/dal/session'
import type { FeedbackResponseRow, Json } from '@/types/database'
import { FEEDBACK_MAX_COMMENT } from './feedback-constants'

/** The structured answers a learner submits. Stored in responses (jsonb). */
export interface FeedbackAnswers {
  /** Overall rating of the session/experience, 1-5. */
  rating: number
  /** How helpful the mentor was, 1-5 (optional when no mentor chosen). */
  mentorHelpfulness?: number
  /** Did the session change how you think about the topic? 1-5. */
  sessionImpact?: number
  /** Free-text comment. */
  comment?: string
}

/** A learner's own feedback row as they view it. */
export interface OwnFeedbackView {
  id: string
  answers: FeedbackAnswers
  isAnonymous: boolean
  createdAt: string
  hasMentor: boolean
}

/** Aggregate, anonymized feedback summary for admins (Ring 2). */
export interface FeedbackAggregate {
  total: number
  averageRating: number | null
  averageMentorHelpfulness: number | null
  averageSessionImpact: number | null
  /** Distribution of overall rating (index 0 => rating 1 ... index 4 => 5). */
  ratingDistribution: [number, number, number, number, number]
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
 * Resolve the calling learner's learner_public.id (RLS lets a learner read their
 * own row). Returns null if the caller has no learner_public row yet.
 */
async function getOwnLearnerPublicId(): Promise<string | null> {
  const session = await requireSession()
  const supabase = await createClient()

  // learner_public RLS allows the learner to read their own alias row via the
  // learner_profiles.user_id link. We select id only (alias not needed here).
  const { data, error } = await supabase
    .from('learner_public')
    .select('id, learner_profiles!inner(user_id)')
    .eq('learner_profiles.user_id', session.userId)
    .maybeSingle()

  if (error) throw error
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Resolve the mentor_public.id of the learner's ACTIVE assigned mentor, if any.
 * ALIAS id only — never touches mentor_profiles.
 */
async function getActiveMentorPublicId(
  learnerPublicId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learner_mentor_assignments')
    .select('mentor_public_id, status')
    .eq('learner_public_id', learnerPublicId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw error
  return (data as { mentor_public_id: string } | null)?.mentor_public_id ?? null
}

export interface SubmitFeedbackResult {
  ok: boolean
  error?: string
}

/**
 * Submit feedback for the calling learner. Learner role only (RLS:
 * feedback_learner_insert checks current_user_role() = 'learner' AND the
 * learner_public_id belongs to auth.uid()). The mentor target is resolved
 * server-side from the active assignment, so a learner cannot attribute feedback
 * to an arbitrary mentor.
 */
export async function submitFeedback(input: {
  answers: FeedbackAnswers
  isAnonymous: boolean
  sessionId?: string | null
}): Promise<SubmitFeedbackResult> {
  await requireRole(['learner'])

  const { rating } = input.answers
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Please give an overall rating from 1 to 5.' }
  }
  const clamp = (v: number | undefined): number | undefined =>
    v === undefined ? undefined : Math.min(5, Math.max(1, Math.round(v)))

  const comment = (input.answers.comment ?? '').trim()
  if (comment.length > FEEDBACK_MAX_COMMENT) {
    return {
      ok: false,
      error: `Keep your comment under ${FEEDBACK_MAX_COMMENT} characters.`,
    }
  }

  const learnerPublicId = await getOwnLearnerPublicId()
  if (!learnerPublicId) {
    return {
      ok: false,
      error: 'Your learner profile is not ready yet. Please try again later.',
    }
  }

  const mentorPublicId = await getActiveMentorPublicId(learnerPublicId)

  const answers: FeedbackAnswers = {
    rating,
    mentorHelpfulness: clamp(input.answers.mentorHelpfulness),
    sessionImpact: clamp(input.answers.sessionImpact),
    comment: comment.length > 0 ? comment : undefined,
  }

  const supabase = await createClient()
  const { error } = await supabase.from('feedback_responses').insert({
    learner_public_id: learnerPublicId,
    session_id: input.sessionId ?? null,
    mentor_public_id: mentorPublicId,
    responses: answers as unknown as Json,
    is_anonymous: input.isAnonymous,
  })

  if (error) throw error
  return { ok: true }
}

/**
 * List the calling learner's own feedback submissions (self-view, PRD §11
 * "View Learner feedback: self"). Newest first.
 */
export async function listOwnFeedback(): Promise<OwnFeedbackView[]> {
  await requireRole(['learner'])

  const learnerPublicId = await getOwnLearnerPublicId()
  if (!learnerPublicId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('feedback_responses')
    .select('id, responses, is_anonymous, mentor_public_id, created_at')
    .eq('learner_public_id', learnerPublicId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as Pick<
      FeedbackResponseRow,
      'id' | 'responses' | 'is_anonymous' | 'mentor_public_id' | 'created_at'
    >
    return {
      id: r.id,
      answers: parseAnswers(r.responses),
      isAnonymous: r.is_anonymous,
      createdAt: r.created_at,
      hasMentor: r.mentor_public_id !== null,
    }
  })
}

/**
 * Aggregate, ANONYMIZED feedback for admins (Ring 2 — no individual identity
 * crosses). Admin/super_admin only. Reads all feedback under RLS (admins may
 * select all rows) and returns counts + averages, never per-learner rows.
 */
export async function getFeedbackAggregate(): Promise<FeedbackAggregate> {
  await requireRole(['admin', 'super_admin'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('feedback_responses')
    .select('responses')

  if (error) throw error

  const rows = (data ?? []) as Pick<FeedbackResponseRow, 'responses'>[]
  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  let ratingSum = 0
  let ratingCount = 0
  let helpSum = 0
  let helpCount = 0
  let impactSum = 0
  let impactCount = 0

  for (const row of rows) {
    const a = parseAnswers(row.responses)
    if (a.rating >= 1 && a.rating <= 5) {
      dist[a.rating - 1] += 1
      ratingSum += a.rating
      ratingCount += 1
    }
    if (a.mentorHelpfulness && a.mentorHelpfulness >= 1) {
      helpSum += a.mentorHelpfulness
      helpCount += 1
    }
    if (a.sessionImpact && a.sessionImpact >= 1) {
      impactSum += a.sessionImpact
      impactCount += 1
    }
  }

  const avg = (sum: number, count: number): number | null =>
    count > 0 ? Math.round((sum / count) * 100) / 100 : null

  return {
    total: rows.length,
    averageRating: avg(ratingSum, ratingCount),
    averageMentorHelpfulness: avg(helpSum, helpCount),
    averageSessionImpact: avg(impactSum, impactCount),
    ratingDistribution: dist,
  }
}
