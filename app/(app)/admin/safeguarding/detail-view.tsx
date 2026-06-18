import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getEscalationDetail } from './_data'
import { CaseActions } from './case-actions'
import type { EscalationStatus } from '@/types/database'

const STATUS_LABEL: Record<EscalationStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
}
const STATUS_VARIANT: Record<EscalationStatus, 'warning' | 'info' | 'success'> = {
  open: 'warning',
  acknowledged: 'info',
  resolved: 'success',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export interface DetailViewProps {
  escalationId: string
  /** Back link to the queue (/admin/safeguarding or /super-admin/safeguarding). */
  basePath: string
}

/**
 * Shared safeguarding case detail. Reveals the confidential follow-through log
 * and the learner's real identity (audited inside getEscalationDetail). For a
 * RESOLVED case the log re-hides by RLS, so the confidential body is no longer
 * shown — only the case metadata and resolution note remain.
 */
export async function DetailView({ escalationId, basePath }: DetailViewProps) {
  const detail = await getEscalationDetail(escalationId)
  if (!detail) notFound()

  const revealed = detail.learner !== null || detail.logNotes !== null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={basePath}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            ← Back to safeguarding queue
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-ink">
            Safeguarding case
          </h1>
        </div>
        <Badge variant={STATUS_VARIANT[detail.status]}>
          {STATUS_LABEL[detail.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Escalation</CardTitle>
            <CardDescription>
              Raised {formatDate(detail.createdAt)}
              {detail.acknowledgedAt
                ? ` · acknowledged ${formatDate(detail.acknowledgedAt)}`
                : ''}
              {detail.resolvedAt
                ? ` · resolved ${formatDate(detail.resolvedAt)}`
                : ''}
            </CardDescription>
          </div>
          <CaseActions escalationId={detail.id} status={detail.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Mentor's reason for escalation">
            <p className="whitespace-pre-wrap text-ink">{detail.reason}</p>
          </Field>
          {detail.auditNotes ? (
            <Field label="Resolution note">
              <p className="whitespace-pre-wrap text-ink">
                {detail.auditNotes}
              </p>
            </Field>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Confidential follow-through log</CardTitle>
          <CardDescription>
            Revealed under the safeguarding workflow. Your access to this record
            is audited.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!revealed ? (
            <p className="text-sm text-ink-muted">
              This case is resolved; the confidential log is no longer revealed.
            </p>
          ) : (
            <>
              {detail.learner ? (
                <div className="rounded-md border border-border bg-surface-muted/50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Learner identity (revealed)
                  </p>
                  <dl className="mt-2 grid gap-1 text-sm">
                    <div className="flex gap-2">
                      <dt className="text-ink-muted">Name:</dt>
                      <dd className="font-medium text-ink">
                        {detail.learner.realName}
                      </dd>
                    </div>
                    {detail.learner.contactNumber ? (
                      <div className="flex gap-2">
                        <dt className="text-ink-muted">Contact:</dt>
                        <dd className="text-ink">
                          {detail.learner.contactNumber}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              <Field label="Log notes">
                <p className="whitespace-pre-wrap text-ink">
                  {detail.logNotes ?? '—'}
                </p>
              </Field>
              <p className="text-xs text-ink-muted">
                Logged {formatDate(detail.logCreatedAt)}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
