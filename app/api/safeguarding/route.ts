// =============================================================================
// Mission ON — Smart Choices
// app/api/safeguarding/route.ts — Route Handler for the safeguarding queue.
//
// NOT cached by default. Authorization is enforced in the colocated data layer
// (requireRole(['admin','super_admin'])); a direct request is fully gated there.
// This list endpoint does NOT reveal log text or learner identity — those are
// only read on the audited detail path. Supports ?status=open|acknowledged|
// resolved|active to filter the queue.
//
// GET -> safeguarding escalations the caller (admin/super_admin) may triage.
// =============================================================================

import { NextResponse } from 'next/server'

import { listEscalations } from '@/app/(app)/admin/safeguarding/_data'
import { AuthorizationError } from '@/lib/dal'
import type { EscalationStatus } from '@/types/database'

const VALID = new Set(['open', 'acknowledged', 'resolved', 'active'])

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const status = new URL(request.url).searchParams.get('status')
    const filter =
      status && VALID.has(status)
        ? (status as EscalationStatus | 'active')
        : undefined

    const escalations = await listEscalations(
      filter ? { status: filter } : undefined
    )
    return NextResponse.json({ escalations })
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/safeguarding]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
