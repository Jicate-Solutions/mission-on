import type { Metadata } from 'next'

import { requireRolePage } from '@/lib/dal'
import { QueueView } from './queue-view'

export const metadata: Metadata = { title: 'Safeguarding — Mission ON' }

/**
 * Admin safeguarding queue. Group layout allows [admin, super_admin]; this
 * page-level gate is belt-and-braces. Acknowledge / resolve and read the
 * confidential, reveal-gated logs from here.
 */
export default async function AdminSafeguardingPage() {
  await requireRolePage(['admin', 'super_admin'])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Safeguarding</h1>
        <p className="mt-1 text-ink-muted">
          Review flagged follow-through cases. You can read a confidential log
          only while its escalation is active, and every access is audited.
        </p>
      </div>
      <QueueView basePath="/admin/safeguarding" />
    </div>
  )
}
