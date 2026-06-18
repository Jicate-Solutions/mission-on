'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client (ANON key).
 *
 * SCOPE: this exists for ONE narrow purpose — the bug-bounty widget's
 * browser-direct Storage upload (`uploadToSignedUrl`). That call authorizes via
 * a short-lived signed token minted server-side, so it does NOT rely on a
 * browser-held auth session.
 *
 * Do NOT use this to read/write application data from the browser. The app's
 * security model keeps the authenticated session server-side (see
 * lib/supabase/server.ts) and routes all data access through the RLS-bound DAL.
 * Per-user data belongs there, never here.
 */
export function createClientSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
