'use server'

// =============================================================================
// Mission ON — Smart Choices
// lib/auth/code-actions.ts — access-code sign-in (doc/update.md §3).
//
// The access code IS the account's Supabase Auth password under a synthetic
// email (see lib/auth/access-code-gen.ts / app/(app)/super-admin/access-codes).
// No parallel session mechanism exists: this ends in the ordinary
// supabase.auth.signInWithPassword() call, so auth.uid(), every RLS policy, and
// verifySession() work completely unchanged — including the per-role layout
// gates that prevent URL-manipulation into another role's dashboard.
//
// SECURITY: this is a Server Action, reachable by a direct POST. The
// access_codes lookup happens via the SERVICE-ROLE admin client because no
// session exists yet at this point (there is nothing for RLS to scope to). All
// failure paths return ONE generic message — never reveal whether the code
// exists, is revoked, or the Supabase-side call itself failed.
// =============================================================================

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashAccessCode } from '@/lib/auth/code-hash'
import { postLoginDestination } from '@/lib/auth/shared'
import type { SignInState } from '@/lib/auth/actions'

/** A login form field value, normalised to a trimmed string. */
function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

// Generic, non-enumerating failure message: never reveal which part of the
// lookup/auth chain failed (unknown code vs. revoked vs. Supabase-side error).
const INVALID_CODE = 'Incorrect access code. Please try again.'

/**
 * Sign in with an access code. Looks up the code's lookup hash in access_codes
 * (service-role — no session exists yet), then signs in as the mapped
 * synthetic-email account via the normal SSR client so the resulting session is
 * an ordinary Supabase Auth session.
 *
 * Signature matches useActionState: (prevState, formData).
 */
export async function signInWithCode(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const code = field(formData, 'code')
  const nextRaw = field(formData, 'next')

  if (!code) {
    return { error: 'Enter your access code.' }
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('access_codes')
    .select('user_id, synthetic_email')
    .eq('code_hash', hashAccessCode(code))
    .eq('status', 'active')
    .maybeSingle()

  if (!row) {
    return { error: INVALID_CODE }
  }
  const { user_id: userId, synthetic_email: syntheticEmail } = row as {
    user_id: string
    synthetic_email: string
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
    password: code,
  })
  if (error) {
    return { error: INVALID_CODE }
  }

  // Usage trail (not an audit entry — matches the existing precedent that
  // routine signIn isn't audited either). Never let this block the login.
  try {
    await admin
      .from('access_codes')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId)
  } catch {
    // Ignored — last_used_at is a convenience trail, not load-bearing.
  }

  const destination = await postLoginDestination(supabase, userId, nextRaw)

  // redirect() throws — must be outside any try/catch.
  redirect(destination)
}
