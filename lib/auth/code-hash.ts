import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// lib/auth/code-hash.ts — deterministic lookup hash for access codes.
//
// A submitted code must be looked up in access_codes BEFORE any Supabase Auth
// call happens (no session exists yet, so RLS is not in play). We can't look it
// up by its Supabase bcrypt password hash (that's salted/non-deterministic by
// design), so we keep a SEPARATE deterministic sha256 lookup hash here. This is
// independent of — and in addition to — Supabase's own bcrypt hash of the same
// string as the account password: two independent one-way hashes protect one
// secret. Same pepper convention as app/(app)/anonymous-chat/anon-dal.ts's
// deriveSessionHash.
// =============================================================================

import { createHash } from 'node:crypto'

/** Dev-only pepper fallback. NEVER used in production (we throw instead). */
const DEV_PEPPER_FALLBACK = 'mission-on-access-code-dev-only'

/**
 * Deterministic, non-reversible lookup hash for an access code. The pepper MUST
 * be a real secret in production: we prefer the purpose-built
 * ACCESS_CODE_PEPPER, then fall back to the (already-required) service-role
 * key. If neither is set in production we THROW rather than silently use a
 * public build constant — a guessable pepper would make the lookup hash
 * effectively reversible, defeating the point of hashing a live credential.
 */
export function hashAccessCode(code: string): string {
  const secretPepper =
    process.env.ACCESS_CODE_PEPPER ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secretPepper && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing ACCESS_CODE_PEPPER (or SUPABASE_SERVICE_ROLE_KEY) in production. ' +
        'A secret pepper is required so the access-code lookup hash cannot be ' +
        'reversed.'
    )
  }

  const pepper = secretPepper ?? DEV_PEPPER_FALLBACK
  return createHash('sha256').update(`${pepper}:${code}`).digest('hex')
}
