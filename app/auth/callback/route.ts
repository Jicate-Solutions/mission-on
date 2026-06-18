// =============================================================================
// Mission ON — Smart Choices
// app/auth/callback/route.ts — OAuth/PKCE + email-confirmation callback.
//
// Supabase redirects here with a `?code=...` after a user clicks the email
// confirmation (or magic) link. We exchange the code for a session (the SSR
// server client reads the PKCE verifier from cookies and writes the session
// cookies — allowed inside a Route Handler), then redirect to a safe internal
// target. On failure we bounce to /login with a generic error flag.
// =============================================================================

import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Only ever honour a relative internal path; default to the holding page.
  const nextParam = searchParams.get('next')
  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/pending'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
