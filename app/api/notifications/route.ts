// =============================================================================
// Mission ON — Smart Choices
// app/api/notifications/route.ts — Route Handlers for the per-user notification
// feed. NOT cached. Authorization is re-verified inside notifications-data.ts
// for every call (a direct request is fully gated there; we also never trust the
// page that linked here).
//
// GET            -> the caller's own feed { notifications, unreadCount }.
//                   ?count=1 returns just { unreadCount } (cheap bell poll).
// PATCH          -> mark all the caller's unread notifications read.
// =============================================================================

import { NextResponse } from 'next/server'

import {
  getOwnNotifications,
  getOwnUnreadCount,
  markAllNotificationsRead,
} from '@/app/api/notifications/notifications-data'
import { AuthorizationError } from '@/lib/dal'

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    if (url.searchParams.get('count') === '1') {
      const unreadCount = await getOwnUnreadCount()
      return NextResponse.json({ unreadCount })
    }

    const limitParam = Number(url.searchParams.get('limit'))
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20

    const feed = await getOwnNotifications(limit)
    return NextResponse.json(feed)
  } catch (err) {
    return errorResponse(err, 'GET')
  }
}

export async function PATCH(): Promise<NextResponse> {
  try {
    const updated = await markAllNotificationsRead()
    return NextResponse.json({ ok: true, updated })
  } catch (err) {
    return errorResponse(err, 'PATCH')
  }
}

function errorResponse(err: unknown, op: string): NextResponse {
  if (err instanceof AuthorizationError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(`[api/notifications:${op}]`, err)
  return NextResponse.json({ error: 'Server error.' }, { status: 500 })
}
