'use server'

// =============================================================================
// Mission ON — Smart Choices
// app/(app)/anonymous-chat/actions.ts — Server Actions for the anonymous chat.
//
// A Server Action is reachable by a DIRECT POST, so authorization lives in the
// DAL functions these call (they each re-verify session/role). These wrappers
// only shape input/output and revalidate the page.
// =============================================================================

import { revalidatePath } from 'next/cache'

import {
  createAnonymousPost,
  setPostHidden,
} from '@/app/(app)/anonymous-chat/anon-dal'

export interface PostState {
  error: string | null
  ok: boolean
}

/** useActionState-shaped action for posting to the anonymous chat. */
export async function postAnonymous(
  _prev: PostState,
  formData: FormData
): Promise<PostState> {
  const body = String(formData.get('body') ?? '')
  const result = await createAnonymousPost(body)
  if (!result.ok) {
    return { error: result.error ?? 'Could not post.', ok: false }
  }
  revalidatePath('/anonymous-chat')
  return { error: null, ok: true }
}

/** Moderation: hide a post (admin/super_admin only — enforced in the DAL). */
export async function hidePost(formData: FormData): Promise<void> {
  const postId = String(formData.get('postId') ?? '')
  if (postId) {
    await setPostHidden(postId, true)
    revalidatePath('/anonymous-chat')
  }
}

/** Moderation: unhide a post (admin/super_admin only — enforced in the DAL). */
export async function unhidePost(formData: FormData): Promise<void> {
  const postId = String(formData.get('postId') ?? '')
  if (postId) {
    await setPostHidden(postId, false)
    revalidatePath('/anonymous-chat')
  }
}
