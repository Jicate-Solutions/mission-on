import type { Metadata } from 'next'
import { EyeOff, Eye, ShieldAlert } from 'lucide-react'

import {
  listAnonymousPosts,
  type AnonymousPostView,
} from '@/app/(app)/anonymous-chat/anon-dal'
import { hidePost, unhidePost } from '@/app/(app)/anonymous-chat/actions'
import { ChatComposer } from '@/app/(app)/anonymous-chat/chat-composer'
import { CrisisPanel } from '@/app/(app)/anonymous-chat/crisis-panel'
import { requireSession, isAdminRole } from '@/lib/dal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Anonymous chat — Mission ON' }

// Per-user, sensitive-context page: never cache.
export const dynamic = 'force-dynamic'

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Shared anonymous chat space (PRD §7.9). Open to ALL roles; the page authorizes
 * via the DAL (requireSession), not the URL. No author identity is stored or
 * shown. Admin/super_admin additionally see hidden posts and moderation
 * controls. Crisis resources are always surfaced.
 */
export default async function AnonymousChatPage() {
  // Any authenticated role may use this space.
  await requireSession()
  const canModerate = await isAdminRole()
  const posts = await listAnonymousPosts()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Anonymous chat</h1>
        <p className="mt-1 text-ink-muted">
          A shared, anonymous space for everyone. No names are stored — speak
          freely and respectfully.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="pt-6">
              <ChatComposer />
            </CardContent>
          </Card>

          <section aria-label="Posts" className="flex flex-col gap-3">
            {posts.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-ink-muted">
                  No posts yet. Be the first to share something.
                </CardContent>
              </Card>
            ) : (
              posts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  canModerate={canModerate}
                />
              ))
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <CrisisPanel />
        </aside>
      </div>
    </div>
  )
}

function PostRow({
  post,
  canModerate,
}: {
  post: AnonymousPostView
  canModerate: boolean
}) {
  return (
    <Card className={post.isHidden ? 'opacity-70' : undefined}>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="neutral">Anonymous</Badge>
            <span className="text-xs text-ink-muted">
              {formatWhen(post.createdAt)}
            </span>
            {post.isHidden ? (
              <Badge variant="danger" className="gap-1">
                <ShieldAlert className="size-3" aria-hidden="true" />
                Hidden
              </Badge>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap break-words text-ink">
            {post.body}
          </p>
        </div>

        {canModerate ? (
          <form
            action={post.isHidden ? unhidePost : hidePost}
            className="shrink-0"
          >
            <input type="hidden" name="postId" value={post.id} />
            <Button
              type="submit"
              variant={post.isHidden ? 'outline' : 'ghost'}
              size="sm"
              title={post.isHidden ? 'Unhide post' : 'Hide post'}
            >
              {post.isHidden ? (
                <>
                  <Eye className="size-4" aria-hidden="true" /> Unhide
                </>
              ) : (
                <>
                  <EyeOff className="size-4" aria-hidden="true" /> Hide
                </>
              )}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}
