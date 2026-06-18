// =============================================================================
// Mission ON — Smart Choices
// app/api/mentors/me/availability/route.ts — the calling mentor's OWN
// availability (JSON, self-service read).
//
// SECURITY: requireRole(['mentor']) inside getOwnAvailability(); the mentor's
// own profile is resolved from the verified session (RLS-scoped to auth.uid()),
// so this NEVER returns another mentor's data. No identity fields are returned
// (availability has none). Never cached. Mutations are done via the colocated
// Server Actions (addAvailability / removeAvailability), not this read endpoint.
// =============================================================================

import { NextResponse } from 'next/server'

import { AuthorizationError } from '@/lib/dal'

import { getOwnAvailability } from '@/app/(app)/mentor/profile/_lib/queries'

export async function GET() {
  try {
    const availability = await getOwnAvailability()
    if (availability === null) {
      return NextResponse.json(
        { error: 'No mentor profile for this account.' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { availability },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/mentors/me/availability] GET failed:', err)
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
  }
}
