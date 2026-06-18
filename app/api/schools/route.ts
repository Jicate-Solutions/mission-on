// =============================================================================
// Mission ON — Smart Choices
// app/api/schools/route.ts — School-pipeline Route Handler (GET list).
//
// Next.js 16: Route Handlers are NOT cached by default. This one reads per-user
// data, so it must stay dynamic. Authorization is re-verified inside the DAL/
// pipeline helpers — the handler itself maps thrown AuthorizationError to a 401/
// 403 and otherwise returns classification-FREE school DTOs only.
//
//   GET /api/schools           -> coordinator: own schools; admin/super: all
//   GET /api/schools?scope=all -> admin/super: all schools (board)
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server'

import { AuthorizationError } from '@/lib/dal'
import {
  listAllSchoolsForBoard,
  listOwnSchools,
} from './_lib/pipeline'

export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get('scope')
    const schools =
      scope === 'all'
        ? await listAllSchoolsForBoard()
        : await listOwnSchools()

    return NextResponse.json(
      { schools },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    if (e instanceof AuthorizationError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    console.error('[GET /api/schools] error:', e)
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    )
  }
}
