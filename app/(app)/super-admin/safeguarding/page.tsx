import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { QueueView } from '@/app/(app)/admin/safeguarding/queue-view'

export const metadata: Metadata = { title: 'Safeguarding — Mission ON' }

/**
 * Super Admin safeguarding queue — final authority on safeguarding cases (PRD
 * §11). Reuses the shared queue components; the data layer accepts super_admin.
 * Links target the super-admin route so detail reads stay in this namespace.
 */
export default async function SuperAdminSafeguardingPage() {
  await requireRolePage(['super_admin'])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Safeguarding</h1>
        <p className="mt-1 text-ink-muted">
          Final authority on flagged follow-through cases. Confidential logs are
          revealed only while a case is active, and every access is audited.
        </p>
      </div>
      <QueueView basePath="/super-admin/safeguarding" />
    </div>
  )
}
