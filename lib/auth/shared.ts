import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/auth/shared.ts — helpers shared by both sign-in paths (email+password
// `signIn` in lib/auth/actions.ts, and access-code `signInWithCode` in
// lib/auth/code-actions.ts) so there is exactly one redirect-resolution rule.
// =============================================================================

import type { createClient } from '@/lib/supabase/server'
import type { Role } from '@/types/database'
import { roleHome } from '@/components/nav/nav-config'

/**
 * Resolve the destination after a successful sign-in. Reads the verified user's
 * role from user_roles (RLS-scoped to their own row) and maps it to the role
 * home. If no role row exists yet (account created but not allocated), we send
 * them to a holding page rather than guessing a role.
 */
export async function postLoginDestination(
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
