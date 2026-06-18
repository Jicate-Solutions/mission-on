import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Session-refresh helper for the root `proxy.ts` (Next.js 16 renamed
 * Middleware to Proxy).
 *
 * Responsibilities:
 *   1. Refresh the Supabase auth token if it expired and write the rotated
 *      cookies onto the outgoing response.
 *   2. Expose the resolved user so the proxy can make an OPTIMISTIC redirect
 *      decision.
 *
 * This is intentionally limited to session refresh + an optimistic read. It is
 * NOT authorization. Real authorization happens in the DAL (lib/dal/*) and is
 * backstopped by Postgres RLS. Never fetch application data here.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  userId: string | null
}> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Do not run code between createServerClient and getUser(). getUser()
  // revalidates the token with the Supabase Auth server and triggers the
  // cookie refresh above.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, userId: user?.id ?? null }
}
