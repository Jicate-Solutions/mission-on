'use server'

// =============================================================================
// Mission ON — Smart Choices
// lib/auth/actions.ts — authentication Server Actions (sign in / sign out).
//
// SECURITY NOTES (Next.js 16):
//   - A Server Action is reachable by a DIRECT POST. These actions deliberately
//     only establish or destroy the Supabase auth session; they do NOT expose
//     any privileged data, and the redirect target is derived solely from the
//     server-verified role, never from caller input.
//   - cookies()/Supabase setAll works inside a Server Action (unlike a Server
//     Component), so signing in here writes the session cookie correctly.
//   - redirect() throws — it is always called OUTSIDE try/catch.
//   - The browser never holds a Supabase session beyond the httpOnly cookies
//     the SSR client sets; it never queries Supabase directly.
// =============================================================================

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { postLoginDestination } from '@/lib/auth/shared'
import type { Role } from '@/types/database'

export interface SignInState {
  /** User-safe error message, or null when no error. */
  error: string | null
}

/** A login form field value, normalised to a trimmed string. */
function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

// Generic, non-enumerating failure message: never reveal whether an email
// exists or which half of the credential pair was wrong.
const INVALID_CREDENTIALS = 'Incorrect email or password. Please try again.'

// Every role except super_admin authenticates with an access code instead
// (doc/update.md §2-3). This is the enforcement that actually retires
// email/password for them — it catches any lingering or future non-super-admin
// credential, independent of which UI a caller reaches this action from.
const NOT_SUPER_ADMIN =
  'This sign-in is for Super Admins only. Use your access code at /login instead.'

/**
 * Sign in with email + password. Reserved for the Super Admin credential login
 * (doc/update.md §2) — every other role authenticates via access code
 * (signInWithCode in lib/auth/code-actions.ts). On success, sets the session
 * cookie and redirects to the role home (or a safe internal `next`). On
 * failure, returns a generic error for the client form to display.
 *
 * Signature matches useActionState: (prevState, formData).
 */
export async function signIn(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = field(formData, 'email')
  const password = field(formData, 'password')
  const nextRaw = field(formData, 'next')

  if (!email || !password) {
    return { error: 'Enter your email and password.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { error: INVALID_CREDENTIALS }
  }

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle()
  const role = (roleRow?.role as Role | undefined) ?? null

  if (role !== null && role !== 'super_admin') {
    // A non-super-admin credential should not exist post-migration, but if one
    // lingers (or is created by mistake) it must not grant a session here.
    await supabase.auth.signOut()
    return { error: NOT_SUPER_ADMIN }
  }

  const destination = await postLoginDestination(
    supabase,
    data.user.id,
    nextRaw
  )

  // redirect() throws — must be outside any try/catch.
  redirect(destination)
}

const PASSWORD_MIN = 8

/**
 * Build the app origin from request headers (so the email-confirmation link
 * points back at this deployment), falling back to NEXT_PUBLIC_SITE_URL.
 */
async function requestOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return host ? `${proto}://${host}` : ''
}

export interface ResetRequestState {
  error: string | null
  /** True once the request was accepted (neutral — does NOT confirm the email exists). */
  sent: boolean
}

/**
 * Request a password-reset email. Sends a Supabase recovery link that routes via
 * /auth/callback (which exchanges the code for a session) to /reset-password.
 *
 * NON-ENUMERATING: we always return sent=true regardless of whether the email
 * has an account — never reveal which addresses are registered.
 *
 * Signature matches useActionState: (prevState, formData).
 */
export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = field(formData, 'email')
  if (!email) {
    return { error: 'Enter your email address.', sent: false }
  }

  const origin = await requestOrigin()
  const supabase = await createClient()
  // Ignore the result: a failure (incl. "no such user") must not be revealed.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin
      ? `${origin}/auth/callback?next=/reset-password`
      : undefined,
  })

  return { error: null, sent: true }
}

export interface UpdatePasswordState {
  error: string | null
}

/**
 * Set a new password for the currently-authenticated user. Reached via the
 * recovery link (which establishes a session through /auth/callback) — or by any
 * signed-in user changing their password. Requires a live session; if the
 * recovery link has expired there is none, so we ask them to request a new one.
 *
 * Signature matches useActionState: (prevState, formData).
 */
export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = field(formData, 'password')
  const confirm = field(formData, 'confirmPassword')

  if (password.length < PASSWORD_MIN) {
    return { error: `Choose a password of at least ${PASSWORD_MIN} characters.` }
  }
  if (password !== confirm) {
    return { error: 'The two passwords do not match.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      error: 'Your reset link has expired. Please request a new one.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: 'Could not update your password. Please try again.' }
  }

  // redirect() throws — must be outside any try/catch.
  redirect('/dashboard')
}

/**
 * Sign out: clears the Supabase session cookies and returns to /login. Safe to
 * call from any authenticated context; if there is no session it is a no-op
 * before the redirect.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
