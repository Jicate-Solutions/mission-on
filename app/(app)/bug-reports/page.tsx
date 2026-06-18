import type { Metadata } from 'next'

import {
  listBugReports,
  type BugReportView,
} from '@/app/(app)/bug-reports/bug-dal'
import {
  BUG_STATUS_LABEL,
  BUG_STATUS_VARIANT,
} from '@/app/(app)/bug-reports/bug-constants'
import { BugForm } from '@/app/(app)/bug-reports/bug-form'
import { TriageForm } from '@/app/(app)/bug-reports/triage-form'
import { requireSession, isAdminRole } from '@/lib/dal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Bug reports — Mission ON' }

export const dynamic = 'force-dynamic'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Shared bug report space (PRD §7.10). Any role can raise a bug and track its
 * status. Admin/super_admin see the full queue with triage controls. Page
 * authorizes via the DAL (requireSession + isAdminRole), not the URL.
 */
export default async function BugReportsPage() {
  await requireSession()
  const canTriage = await isAdminRole()
  const reports = await listBugReports()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Bug reports</h1>
        <p className="mt-1 text-ink-muted">
          Found something broken? Tell us. You can follow your report&apos;s
          status here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report a problem</CardTitle>
        </CardHeader>
        <CardContent>
          <BugForm />
        </CardContent>
      </Card>

      <section aria-label="Reports" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">
            {canTriage ? 'Report queue' : 'Your reports'}
          </h2>
          {canTriage ? (
            <a
              href="/api/bug-reports/export"
              download
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
            >
              ⬇ Export for Bug Agent
            </a>
          ) : null}
        </div>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-ink-muted">
              {canTriage
                ? 'No bug reports yet.'
                : 'You have not reported any bugs yet.'}
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <BugCard
              key={report.id}
              report={report}
              canTriage={canTriage}
            />
          ))
        )}
      </section>
    </div>
  )
}

function BugCard({
  report,
  canTriage,
}: {
  report: BugReportView
  canTriage: boolean
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {report.displayId ? (
            <span className="font-mono text-xs text-ink-muted">
              {report.displayId}
            </span>
          ) : null}
          <Badge variant={BUG_STATUS_VARIANT[report.status]}>
            {BUG_STATUS_LABEL[report.status]}
          </Badge>
          {report.severity ? (
            <Badge variant={report.severity === 'P0' || report.severity === 'P1' ? 'warning' : 'neutral'}>
              {report.severity}
            </Badge>
          ) : null}
          {report.module ? (
            <Badge variant="neutral">{report.module}</Badge>
          ) : null}
          {canTriage ? (
            <Badge variant="neutral">by {report.reporterRole}</Badge>
          ) : null}
          {report.isOwn && canTriage ? (
            <Badge variant="info">your report</Badge>
          ) : null}
          <span className="text-xs text-ink-muted">
            {formatWhen(report.createdAt)}
          </span>
        </div>

        <p className="whitespace-pre-wrap break-words text-ink">
          {report.description}
        </p>

        {report.resolution ? (
          <div className="rounded-md bg-surface-muted px-3 py-2">
            <p className="text-xs font-medium text-ink-muted">Resolution</p>
            <p className="whitespace-pre-wrap break-words text-sm text-ink">
              {report.resolution}
            </p>
          </div>
        ) : null}

        {canTriage ? (
          <TriageForm
            bugId={report.id}
            currentStatus={report.status}
            currentResolution={report.resolution}
            currentSeverity={report.severity}
            assignedToMe={report.assignedToMe}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
