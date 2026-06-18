import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware-session'

/**
 * Proxy (Next.js 16 renamed Middleware -> Proxy).
 *
 * OPTIMISTIC redirect checks ONLY. This file:
 *   - refreshes the Supabase session cookie (updateSession),
 *   - reads whether a session exists (cookie-level, not a DB role check),
 *   - redirects unauthenticated users away from protected groups to /login,
 *   - redirects authenticated users away from auth pages (/login, /signup).
 *
 * This is NOT authorization. It runs on every matched route including
 * prefetches, so it must never fetch application data or check roles. Real
 * authorization lives in the DAL (lib/dal/*) and Postgres RLS.
 */

// Public routes that an unauthenticated visitor may reach.
const PUBLIC_PREFIXES = ['/login', '/signup', '/auth', '/forgot-password']

// Landing page is public; everything else under the app is protected.
const PUBLIC_EXACT = ['/']

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isAuthPage(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/')
  )
}

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request)
  const { pathname } = request.nextUrl

  const authenticated = userId !== null

  // 1. Unauthenticated user hitting a protected route -> /login (preserve target).
  if (!authenticated && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // 2. Authenticated user hitting an auth page -> /dashboard.
  if (authenticated && isAuthPage(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // 3. Otherwise continue, carrying any refreshed session cookies.
  return response
}

export const config = {
  // Run on everything except Next internals, static assets, and common files.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)$).*)',
  ],
}
