// =============================================================================
// Mission ON — Smart Choices
// app/api/schools/[schoolId]/sessions/route.ts — session logistics for a school.
//
// GET returns classification-FREE session logistics. The `sessions` parent is
// module-free (the module anchor moved to the admin-only session_design child,
// 0006); all roles read the base table with a safe-column allow-list, scoped by
// RLS. NO module_code is ever projected. Authorization + self-scoping is enforced
// inside listSchoolSessions.
//
// Next 16: params is a Promise and must be awaited.
// =============================================================================

import { NextResponse } from 'next/server'

import { AuthorizationError } from '@/lib/dal'
import { listSchoolSessions } from '../../_lib/pipeline'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId } = await params
    const sessions = await listSchoolSessions(schoolId)
    return NextResponse.json(
      { sessions },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[GET /api/schools/[schoolId]/sessions] error:', e)
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
  }
}
