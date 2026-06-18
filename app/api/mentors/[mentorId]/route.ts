// =============================================================================
// Mission ON — Smart Choices
// app/api/mentors/[mentorId]/route.ts — Admin mentor detail (JSON).
//
// SECURITY: admin/super_admin ONLY. Returns the FULL admin detail (real
// identity + availability + allocations) via getMentorAdminDetail(), which
// re-verifies the role and reads real identity through the admin-guarded DAL
// getMentorFull(). This is the ONLY mentor API that returns real identity, and
// it is gated by requireRole inside the query. Never cached.
//
// Identity returned here is by design for the admin UI. Do NOT add a learner-
// or mentor-reachable caller to this route.
// =============================================================================

import { NextResponse } from 'next/server'

import { AuthorizationError } from '@/lib/dal'

import { getMentorAdminDetail } from '@/app/(app)/admin/mentors/_lib/queries'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mentorId: string }> }
) {
  try {
    const { mentorId } = await params
    const detail = await getMentorAdminDetail(mentorId)
    if (!detail) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/mentors/:id] GET failed:', err)
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
  }
}
