// =============================================================================
// Mission ON — Smart Choices
// app/api/bug-reports/route.ts — Route Handlers for the bug report system.
//
// NOT cached by default. Authorization is enforced in the DAL (each function
// re-verifies session/role). A direct request is fully gated there.
//
// GET  -> list reports the caller may see (own for reporters; all for admins).
// POST -> raise a bug { description } (any authenticated role).
// =============================================================================

import { NextResponse } from 'next/server'

import {
  listBugReports,
  createBugReport,
} from '@/app/(app)/bug-reports/bug-dal'
import { AuthorizationError } from '@/lib/dal'

export async function GET(): Promise<NextResponse> {
  try {
    const reports = await listBugReports()
    return NextResponse.json({ reports })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json().catch(() => null)) as {
      description?: unknown
    } | null
    const description =
      typeof payload?.description === 'string' ? payload.description : ''

    const result = await createBugReport(description)
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
  console.error('[api/bug-reports]', err)
  return NextResponse.json({ error: 'Server error.' }, { status: 500 })
}
