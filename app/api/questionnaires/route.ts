// =============================================================================
// Mission ON — Smart Choices
// app/api/questionnaires/route.ts — Questionnaire lifecycle API.
//
// Next.js 16 Route Handlers are NOT cached by default and are reachable by a
// DIRECT request, so authorization happens INSIDE the handler (never trusting a
// page gate). This endpoint deliberately serves the CLASSIFICATION-FREE
// lifecycle view so a coordinator-or-above can read questionnaire status without
// any module code crossing the wire. The classification API lives separately at
// /api/questionnaires/[id]/classification (admin/super_admin only).
// =============================================================================

import { NextResponse } from 'next/server'

import { verifySession, AuthorizationError } from '@/lib/dal'
import {
  getCoordinatorQuestionnaires,
} from '@/app/(app)/coordinator/questionnaires/_data'

const ALLOWED = new Set(['coordinator', 'admin', 'super_admin'])

/**
 * GET /api/questionnaires
 * Returns the caller's questionnaire lifecycle rows (no classification).
 * coordinator/admin/super_admin only; RLS scopes coordinators to owned schools.
 */
export async function GET(): Promise<Response> {
  const session = await verifySession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }
  if (session.role === null || !ALLOWED.has(session.role)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  try {
    const rows = await getCoordinatorQuestionnaires()
    return NextResponse.json({ data: rows }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : 'Unexpected error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
