// =============================================================================
// Mission ON — Smart Choices
// app/api/bug-reports/[id]/route.ts — admin triage Route Handler.
//
// PATCH -> triage / assign / resolve / close a bug. Admin/super_admin only,
// enforced inside triageBugReport() (re-verifies role). assigneeId is taken from
// the request body but the DAL only permits this for admins; a non-admin call
// throws 403 before any write.
// =============================================================================

import { NextResponse } from 'next/server'

import { triageBugReport } from '@/app/(app)/bug-reports/bug-dal'
import { AuthorizationError } from '@/lib/dal'
import type { BugStatus } from '@/types/database'

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await ctx.params
    const payload = (await request.json().catch(() => null)) as {
      status?: unknown
      assigneeId?: unknown
      resolution?: unknown
    } | null

    const result = await triageBugReport({
      bugId: id,
      status:
        typeof payload?.status === 'string'
          ? (payload.status as BugStatus)
          : undefined,
      assigneeId:
        payload?.assigneeId === undefined
          ? undefined
          : payload?.assigneeId === null
            ? null
            : String(payload.assigneeId),
      resolution:
        typeof payload?.resolution === 'string'
          ? payload.resolution
          : undefined,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/bug-reports/[id]]', err)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
