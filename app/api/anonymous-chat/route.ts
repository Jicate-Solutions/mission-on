// =============================================================================
// Mission ON — Smart Choices
// app/api/anonymous-chat/route.ts — Route Handlers for the anonymous chat.
//
// NOT cached by default (Next 16 route handlers). Every handler goes through the
// module DAL, which re-verifies the session/role internally — a direct request
// is fully authorized at the DAL boundary, not by any page gate.
//
// GET  -> list visible posts (any authenticated user).
// POST -> create a post { body } (any authenticated user; rate-limited by a
//         one-way session hash; NO author identity stored).
// =============================================================================

import { NextResponse } from 'next/server'

import {
  listAnonymousPosts,
  createAnonymousPost,
} from '@/app/(app)/anonymous-chat/anon-dal'
import { AuthorizationError } from '@/lib/dal'

export async function GET(): Promise<NextResponse> {
  try {
    const posts = await listAnonymousPosts()
    return NextResponse.json({ posts })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json().catch(() => null)) as {
      body?: unknown
    } | null
    const body = typeof payload?.body === 'string' ? payload.body : ''

    const result = await createAnonymousPost(body)
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
  console.error('[api/anonymous-chat]', err)
  return NextResponse.json({ error: 'Server error.' }, { status: 500 })
}
