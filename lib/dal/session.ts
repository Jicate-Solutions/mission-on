import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/dal/session.ts — The session/authorization core of the Data Access Layer.
//
// SECURITY SPINE (layer 2 of 3): proxy.ts is optimistic redirect only; this DAL
// is the real authorization boundary; Postgres RLS is the backstop. EVERY DAL
// function and EVERY Server Action MUST re-verify session + role internally
// because a Server Action / Route Handler is reachable by a DIRECT POST that
// bypasses any page-level check.
//
// verifySession() reads the SSR Supabase client (anon key, RLS-scoped) which
// validates the token against the Supabase Auth server. It is memoized per
// request with React cache() so repeated DAL calls in one render do not
// re-hit auth. Reading cookies FIRST (via the SSR client) also keeps per-user
// data out of any shared cache.
// =============================================================================

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/types/database'

export interface SessionContext {
  userId: string
  role: Role | null
  /** Coordinator scope: their owned school (user_roles.school_id). */
  schoolId: string | null
  /** Optional sub-role flag (e.g. 'jkkn_counsellor'). */
  subRole: 'jkkn_counsellor' | null
}

/**
 * Resolve the current authenticated session + role, or `null` if unauthenticated.
 *
 * Memoized with React cache() so it runs at most once per request. Uses
 * supabase.auth.getUser() (validates the JWT with the Auth server — do NOT
 * trust getSession() alone) and then reads the role from user_roles under RLS.
 *
 * Returns null (does NOT redirect) so callers can decide between a redirect
 * (pages) and a thrown 401/403 (Route Handlers / Server Actions).
 */
export const verifySession = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    // Read the caller's role row. RLS on user_roles allows a user to read their
    // own row; current_user_role() (SECURITY DEFINER) backs the helper fns.
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role, school_id, sub_role')
      .eq('user_id', user.id)
      .maybeSingle()

    return {
      userId: user.id,
      role: (roleRow?.role as Role | undefined) ?? null,
      schoolId: roleRow?.school_id ?? null,
      subRole:
        (roleRow?.sub_role as 'jkkn_counsellor' | undefined) ?? null,
    }
  }
)

/**
 * Like verifySession() but REDIRECTS unauthenticated callers to /login. Use in
 * Server Components / pages where a redirect is the right UX.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await verifySession()
  if (!session) redirect('/login')
  return session
}

/** The current caller's role (or null). Convenience over verifySession(). */
export async function getCurrentUserRole(): Promise<Role | null> {
  const session = await verifySession()
  return session?.role ?? null
}

/**
 * Error thrown by requireRole/assertRole when authorization fails. Carries an
 * HTTP-ish status so Route Handlers can map it to 401/403 cleanly. (Pages
 * should prefer requireRolePage which redirects.)
 */
export class AuthorizationError extends Error {
  readonly status: 401 | 403
  constructor(message: string, status: 401 | 403) {
    super(message)
    this.name = 'AuthorizationError'
    this.status = status
  }
}

/**
 * Assert the caller holds one of `roles`. THROWS AuthorizationError on failure
 * (401 if unauthenticated, 403 if wrong role). Use in Server Actions and Route
 * Handlers where throwing is correct. Returns the verified SessionContext so the
 * caller can reuse userId/role/schoolId without re-querying.
 *
 * This is the line of defense against a direct POST to a Server Action: the page
 * gate is irrelevant; THIS check is what actually authorizes the operation.
 */
export async function requireRole(
  roles: readonly Role[]
): Promise<SessionContext> {
  const session = await verifySession()
  if (!session) {
    throw new AuthorizationError('Not authenticated.', 401)
  }
  if (session.role === null || !roles.includes(session.role)) {
    throw new AuthorizationError(
      `Forbidden: requires one of [${roles.join(', ')}].`,
      403
    )
  }
  return session
}

/**
 * Same intent as requireRole but REDIRECTS instead of throwing — for use in
 * Server Components / pages (unauthenticated -> /login, wrong role ->
 * /dashboard). Returns the verified SessionContext.
 */
export async function requireRolePage(
  roles: readonly Role[]
): Promise<SessionContext> {
  const session = await verifySession()
  if (!session) redirect('/login')
  if (session.role === null || !roles.includes(session.role)) {
    redirect('/dashboard')
  }
  return session
}

/** True when the caller is admin or super_admin. */
export async function isAdminRole(): Promise<boolean> {
  const role = await getCurrentUserRole()
  return role === 'admin' || role === 'super_admin'
}

/** True when the caller is super_admin. */
export async function isSuperAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole()
  return role === 'super_admin'
}
