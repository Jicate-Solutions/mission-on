import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { MentorChangeQueueView } from '@/components/mentor-changes/queue-view'

export const metadata: Metadata = {
  title: 'Mentor-change requests — Mission ON',
}

// Per-user sensitive admin data: never cache.
export const dynamic = 'force-dynamic'

/**
 * Super Admin mentor-change request queue (PRD §7.6, §9.2). super_admin has the
 * same administrative authority as admin over these requests, so this reuses the
 * shared queue + data/actions (all of which accept admin/super_admin). The
 * route-group layout restricts entry to super_admin; the page gate is
 * belt-and-braces. Aliases only — no real learner/mentor identity.
 */
export default async function SuperAdminMentorChangesPage() {
  await requireRolePage(['super_admin'])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Mentor-change requests
        </h1>
        <p className="mt-1 text-ink-muted">
          Review learner requests to change mentor. Approve to open the switch —
          pick a new mentor by alias — or reject to keep the current mentor.
          Learner and mentor identities are shown by alias only.
        </p>
      </div>
      <MentorChangeQueueView />
    </div>
  )
}
