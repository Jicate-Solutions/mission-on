import 'server-only'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/anonymous-chat/anon-dal.ts — module-local server-only data access
// for the anonymous chat space (PRD §7.9, §12).
//
// HARD RULE (PRD §12): "Anonymous chat stores no author identity." We NEVER
// write a user_id. To support lightweight per-user rate limiting WITHOUT
// identity, we derive a ONE-WAY salted hash of the session user id and store
// only that hash (anonymous_posts.session_token_hash). The hash is keyed by a
// server-side secret pepper so it is not reversible to a user id and is not
// linkable across deployments. It is used ONLY to count a user's recent posts.
//
// Moderation is by CONTENT only: admin/super_admin may hide a post (toggle
// is_hidden); no author is ever revealed because none is stored.
//
// This file re-verifies the session in every function (defense against direct
// invocation) and goes through the RLS-scoped SSR client, except the hide path
// which writes an audit entry via the DAL audit RPC.
// =============================================================================

import { createHash } from 'node:crypto'

import { createClient } from '@/lib/supabase/server'
import { requireSession, requireRole } from '@/lib/dal/session'
import { writeAudit } from '@/lib/dal/audit'
import { ANON_MAX_BODY } from '@/app/(app)/anonymous-chat/anon-dal-constants'
import type { AnonymousPostRow } from '@/types/database'

export { ANON_MAX_BODY }

/** Max posts a single (hashed) session may create within the window. */
export const ANON_RATE_LIMIT = 5
/** Rate-limit window in milliseconds (10 minutes). */
export const ANON_RATE_WINDOW_MS = 10 * 60 * 1000

/**
 * Public DTO for an anonymous post. Carries NO author field — there is nothing
 * to carry. `isHidden`/`canModerate` drive the moderation UI for admins.
 */
export interface AnonymousPostView {
  id: string
  body: string
  createdAt: string
  isHidden: boolean
}

/** Dev-only pepper fallback. NEVER used in production (we throw instead). */
const DEV_PEPPER_FALLBACK = 'mission-on-anon-dev-only'

/**
 * Derive a NON-reversible, NON-identity rate-limit token from the verified
 * session user id. Salted with a server-side secret pepper so the stored value
 * cannot be mapped back to a user.
 *
 * The pepper MUST be a real secret in production: we prefer the purpose-built
 * ANON_CHAT_PEPPER, then fall back to the (already-required) service-role key.
 * If neither is set in production we THROW rather than silently use a public
 * build constant — a guessable pepper would make the stored hashes effectively
 * reversible to user ids, defeating the anonymity guarantee (PRD §12). In
 * non-production we allow a constant so local dev runs without extra setup.
 */
function deriveSessionHash(userId: string): string {
  const secretPepper =
    process.env.ANON_CHAT_PEPPER ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!secretPepper && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing ANON_CHAT_PEPPER (or SUPABASE_SERVICE_ROLE_KEY) in production. ' +
        'A secret pepper is required so anonymous-post rate-limit hashes cannot ' +
        'be reversed to user ids.'
    )
  }

  const pepper = secretPepper ?? DEV_PEPPER_FALLBACK
  return createHash('sha256').update(`${pepper}:${userId}`).digest('hex')
}

function toView(
  row: Pick<AnonymousPostRow, 'id' | 'body' | 'created_at' | 'is_hidden'>
): AnonymousPostView {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    isHidden: row.is_hidden,
  }
}

/**
 * List anonymous posts visible to the caller (RLS: non-hidden for everyone,
 * hidden too for admins). Newest first.
 */
export async function listAnonymousPosts(
  limit = 100
): Promise<AnonymousPostView[]> {
  await requireSession()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('anonymous_posts')
    .select('id, body, created_at, is_hidden')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(toView)
}

export interface CreatePostResult {
  ok: boolean
  error?: string
}

/**
 * Create an anonymous post. Stores NO user id — only the one-way session hash
 * for rate limiting. Enforces a length cap and a sliding-window per-hash limit.
 */
export async function createAnonymousPost(
  rawBody: string
): Promise<CreatePostResult> {
  const session = await requireSession()

  const body = rawBody.trim()
  if (body.length === 0) {
    return { ok: false, error: 'Write something before posting.' }
  }
  if (body.length > ANON_MAX_BODY) {
    return {
      ok: false,
      error: `Keep it under ${ANON_MAX_BODY} characters.`,
    }
  }

  const sessionHash = deriveSessionHash(session.userId)
  const supabase = await createClient()

  // Sliding-window rate limit by the (non-identity) hash.
  const windowStart = new Date(Date.now() - ANON_RATE_WINDOW_MS).toISOString()
  const { count, error: countError } = await supabase
    .from('anonymous_posts')
    .select('id', { count: 'exact', head: true })
    .eq('session_token_hash', sessionHash)
    .gte('created_at', windowStart)

  if (countError) throw countError
  if ((count ?? 0) >= ANON_RATE_LIMIT) {
    return {
      ok: false,
      error: 'You are posting a lot — please wait a few minutes and try again.',
    }
  }

  // INSERT with NO user_id — only body + the one-way hash.
  const { error } = await supabase.from('anonymous_posts').insert({
    body,
    session_token_hash: sessionHash,
  })

  if (error) throw error
  return { ok: true }
}

export interface ModeratePostResult {
  ok: boolean
  error?: string
}

/**
 * Hide or unhide a post (content moderation). Admin/super_admin only. Writes an
 * audit entry (anonymous_post.hide) on hide. No author is touched — none exists.
 */
export async function setPostHidden(
  postId: string,
  hidden: boolean
): Promise<ModeratePostResult> {
  const session = await requireRole(['admin', 'super_admin'])

  const supabase = await createClient()
  const { error } = await supabase
    .from('anonymous_posts')
    .update(
      hidden
        ? {
            is_hidden: true,
            hidden_by: session.userId,
            hidden_at: new Date().toISOString(),
          }
        : { is_hidden: false, hidden_by: null, hidden_at: null }
    )
    .eq('id', postId)

  if (error) throw error

  if (hidden) {
    await writeAudit({
      action: 'anonymous_post.hide',
      entityType: 'anonymous_posts',
      entityId: postId,
      actorId: session.userId,
      metadata: { role: session.role },
    })
  }

  return { ok: true }
}
