import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * SSR Supabase client bound to the current request's cookies.
 *
 * This client uses the ANON key and therefore operates under Row Level
 * Security as the signed-in user. It is the client the DAL uses to read the
 * authenticated session (verifySession) and to run RLS-governed queries.
 *
 * IMPORTANT (Next.js 16): `cookies()` is async. Call this factory only from
 * Server Components, Route Handlers, or Server Actions — never from the
 * browser. The browser must never hold a Supabase session.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // `setAll` was called from a Server Component, where mutating
            // cookies is not allowed. This is safe to ignore when session
            // refresh is handled in the proxy via updateSession().
          }
        },
      },
    }
  )
}
