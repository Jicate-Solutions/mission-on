// =============================================================================
// Mission ON — Smart Choices
// app/api/follow-through/route.ts — Route Handler for a mentor's own logs.
//
// NOT cached by default. Authorization is enforced in the colocated data layer
// (requireRole(['mentor'])); a direct request is fully gated there. Ring-1
// confidential — only the authoring mentor's logs are ever returned (RLS +
// app gate). Aliases only; no learner real identity crosses this boundary.
//
// GET -> the calling mentor's follow-through logs (alias-decorated).
// =============================================================================

import { NextResponse } from 'next/server'

import { getOwnLogs } from '@/app/(app)/mentor/follow-through/_data'
import { AuthorizationError } from '@/lib/dal'

export async function GET(): Promise<NextResponse> {
  try {
    const logs = await getOwnLogs()
    return NextResponse.json({ logs })
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/follow-through]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
