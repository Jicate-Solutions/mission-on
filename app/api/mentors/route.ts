// =============================================================================
// Mission ON — Smart Choices
// app/api/mentors/route.ts — Admin mentor directory (JSON, alias-only list).
//
// SECURITY (Next.js 16): Route Handlers are NOT cached by default and are
// reachable by a direct request — so this handler re-verifies admin/super_admin
// internally via the DAL. It returns the alias-only directory (MentorPublic);
// real identity is NEVER returned by this collection endpoint. For one mentor's
// full identity, use GET /api/mentors/[mentorId] (also admin-gated).
//
// AuthorizationError -> 401/403; anything else -> 500 with a generic message
// (no internal detail leaks to the client).
// =============================================================================

import { NextResponse } from 'next/server'

import { AuthorizationError } from '@/lib/dal'

import { listMentorsForAdmin } from '@/app/(app)/admin/mentors/_lib/queries'

export async function GET() {
  try {
    const mentors = await listMentorsForAdmin()
    return NextResponse.json(
      { mentors },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/mentors] GET failed:', err)
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    )
  }
}
