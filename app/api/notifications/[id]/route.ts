// =============================================================================
// Mission ON — Smart Choices
// app/api/notifications/[id]/route.ts — Mark a single notification read.
// NOT cached. Re-verifies the session and scopes the update to the caller's own
// row inside notifications-data.ts (RLS notif_self_update is the backstop).
//
// PATCH -> mark notification :id read (own row only). Idempotent.
// =============================================================================

import { NextResponse } from 'next/server'

import { markNotificationRead } from '@/app/api/notifications/notifications-data'
import { AuthorizationError } from '@/lib/dal'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params
    const updated = await markNotificationRead(id)
    return NextResponse.json({ ok: true, updated })
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/notifications/[id]:PATCH]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
