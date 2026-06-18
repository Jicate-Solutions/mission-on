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
import type { Role } from '@/types/database'
import { roleHome } from '@/components/nav/nav-config'

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

/**
 * Resolve the destination after a successful sign-in. Reads the verified user's
 * role from user_roles (RLS-scoped to their own row) and maps it to the role
 * home. If no role row exists yet (account created but not allocated), we send
 * them to a holding page rather than guessing a role.
 */
async function postLoginDestination(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fallback: string
): Promise<string> {
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  const role = (roleRow?.role as Role | undefined) ?? null
  if (!role) {
    // Authenticated but not yet allocated a role by an admin.
    return '/pending'
  }

  // Only honour an internal relative "next" target; ignore anything else to
  // avoid open-redirects.
  if (fallback.startsWith('/') && !fallback.startsWith('//')) {
    return fallback
  }
  return roleHome(role)
}

/**
 * Sign in with email + password. On success, sets the session cookie and
 * redirects to the role home (or a safe internal `next`). On failure, returns a
 * generic error for the client form to display.
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

  const destination = await postLoginDestination(
    supabase,
    data.user.id,
    nextRaw
  )

  // redirect() throws — must be outside any try/catch.
  redirect(destination)
}

export interface SignUpState {
  /** User-safe error message, or null when no error. */
  error: string | null
  /** True when the account was created but an email confirmation is required. */
  needsConfirmation?: boolean
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

/**
 * Self-service registration. Creates a Supabase Auth account ONLY — it does NOT
 * grant a role. Per the RBAC model, role allocation is an Admin/Super Admin
 * action (user_roles is admin-write-only under RLS), so a fresh account cannot
 * elevate itself: on first sign-in it lands on /pending until an admin allocates
 * a role. This keeps self-signup safe while still letting people create accounts.
 *
 * Behaviour depends on the project's "Confirm email" setting:
 *   - confirmation OFF -> a session is returned; we redirect to /pending.
 *   - confirmation ON  -> no session; we return needsConfirmation so the form
 *     shows a "check your email" state. The link routes via /auth/callback.
 *
 * Signature matches useActionState: (prevState, formData).
 */
export async function signUp(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const fullName = field(formData, 'fullName')
  const email = field(formData, 'email')
  const password = field(formData, 'password')
  const confirm = field(formData, 'confirmPassword')

  if (!fullName || !email || !password) {
    return { error: 'Enter your name, email, and a password.' }
  }
  if (password.length < PASSWORD_MIN) {
    return { error: `Choose a password of at least ${PASSWORD_MIN} characters.` }
  }
  if (password !== confirm) {
    return { error: 'The two passwords do not match.' }
  }

  const origin = await requestOrigin()
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: origin
        ? `${origin}/auth/callback?next=/pending`
        : undefined,
    },
  })

  if (error) {
    // Non-enumerating: never reveal whether the email already exists.
    return {
      error:
        'We could not create that account. Try a different email, or sign in if you already have one.',
    }
  }

  // Confirmation disabled -> authenticated immediately -> holding page.
  if (data.session) {
    redirect('/pending')
  }

  // Confirmation required -> ask the user to check their inbox.
  return { error: null, needsConfirmation: true }
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
