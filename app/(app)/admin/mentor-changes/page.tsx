import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { MentorChangeQueueView } from '@/components/mentor-changes/queue-view'

export const metadata: Metadata = {
  title: 'Mentor-change requests — Admin — Mission ON',
}

// Per-user sensitive admin data: never cache.
export const dynamic = 'force-dynamic'

/**
 * Admin mentor-change request queue (PRD §7.6, §9.2). Learners raise a
 * "change my Mentor" request; admins review here and approve (opening the
 * switch to a new mentor, by alias) or reject. The group layout allows
 * [admin, super_admin]; this page-level gate is belt-and-braces and each
 * data/action call re-verifies internally. Aliases only — no real identity.
 */
export default async function AdminMentorChangesPage() {
  await requireRolePage(['admin', 'super_admin'])

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
