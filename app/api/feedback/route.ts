// =============================================================================
// Mission ON — Smart Choices
// app/api/feedback/route.ts — Route Handlers for feedback.
//
// NOT cached. Authorization enforced in the DAL (re-verifies role per call).
//
// GET  -> ?view=mine  : the calling learner's own feedback (learner only).
//         ?view=aggregate : anonymized aggregate (admin/super_admin only).
// POST -> submit feedback (learner only); body is the FeedbackAnswers shape.
// =============================================================================

import { NextResponse } from 'next/server'

import {
  listOwnFeedback,
  getFeedbackAggregate,
  submitFeedback,
} from '@/app/(app)/learner/feedback/feedback-dal'
import { AuthorizationError } from '@/lib/dal'

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const view = url.searchParams.get('view')

    if (view === 'aggregate') {
      const aggregate = await getFeedbackAggregate()
      return NextResponse.json({ aggregate })
    }
    // Default: the learner's own feedback.
    const feedback = await listOwnFeedback()
    return NextResponse.json({ feedback })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json().catch(() => null)) as {
      rating?: unknown
      mentorHelpfulness?: unknown
      sessionImpact?: unknown
      comment?: unknown
      isAnonymous?: unknown
    } | null

    const num = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? v : undefined

    const result = await submitFeedback({
      answers: {
        rating: num(payload?.rating) ?? 0,
        mentorHelpfulness: num(payload?.mentorHelpfulness),
        sessionImpact: num(payload?.sessionImpact),
        comment:
          typeof payload?.comment === 'string' ? payload.comment : undefined,
      },
      isAnonymous: payload?.isAnonymous === true,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error('[api/feedback]', err)
  return NextResponse.json({ error: 'Server error.' }, { status: 500 })
}
