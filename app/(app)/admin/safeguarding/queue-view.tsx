import Link from 'next/link'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listEscalations, type QueueItem } from './_data'
import {
  getSafeguardingContacts,
  type SafeguardingContact,
} from './_contacts'
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

export interface QueueViewProps {
  /** Base href for case detail links (/admin/safeguarding or /super-admin/...). */
  basePath: string
}

/**
 * Shared safeguarding queue, rendered by both the admin and super-admin pages.
 * Lists active and resolved escalations WITHOUT revealing log text or learner
 * identity — those appear only on the audited detail view. Reason text the
 * escalating mentor wrote is shown so the team can triage.
 */
export async function QueueView({ basePath }: QueueViewProps) {
  const items = await listEscalations()
  const contacts = await getSafeguardingContacts()
  const active = items
    .filter((i) => i.status === 'open' || i.status === 'acknowledged')
    // Overdue cases float to the top of the queue (PRD §12 timelines).
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue))
  const resolved = items.filter((i) => i.status === 'resolved')
  const overdueCount = active.filter((i) => i.isOverdue).length

  return (
    <div className="flex flex-col gap-6">
      <ContactsCard contacts={contacts} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Active cases
            {overdueCount > 0 ? (
              <Badge variant="danger">{overdueCount} overdue</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Open and acknowledged safeguarding escalations. Overdue cases (past
            the response window) are flagged and listed first. Open a case to
            read the confidential log and the learner&apos;s details (access is
            audited).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueueTable items={active} basePath={basePath} emptyLabel="No active cases. " />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolved cases</CardTitle>
          <CardDescription>
            Closed cases for the record. The confidential log re-hides once a
            case is resolved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueueTable
            items={resolved}
            basePath={basePath}
            emptyLabel="No resolved cases yet."
          />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Read-only "Designated contacts" card shown to all admins at the top of the
 * safeguarding queue (PRD §12). Lists the named safeguarding contacts so the
 * team always knows who the designated lead / contacts are. Edited only by a
 * super_admin under /super-admin/safeguarding-contacts.
 */
function ContactsCard({ contacts }: { contacts: SafeguardingContact[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Designated contacts</CardTitle>
        <CardDescription>
          The named safeguarding lead and contacts to reach for a flagged case.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No safeguarding contacts have been set yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {contacts.map((c, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="font-medium text-ink">
                  {c.name}
                  {c.roleTitle ? (
                    <span className="font-normal text-ink-muted">
                      {' '}
                      — {c.roleTitle}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-ink-muted">
                  <a
                    href={`tel:${c.phone}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {c.phone}
                  </a>
                  {c.email ? (
                    <>
                      {' · '}
                      <a
                        href={`mailto:${c.email}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {c.email}
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function QueueTable({
  items,
  basePath,
  emptyLabel,
}: {
  items: QueueItem[]
  basePath: string
  emptyLabel: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyLabel}</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reason</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Raised</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="max-w-md">
              <Link
                href={`${basePath}/${item.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                <span className="line-clamp-2">{item.reason}</span>
              </Link>
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap items-center gap-1">
                <Badge variant={STATUS_VARIANT[item.status]}>
                  {STATUS_LABEL[item.status]}
                </Badge>
                {item.isOverdue ? (
                  <Badge variant="danger">Overdue</Badge>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap text-ink-muted">
              {formatDate(item.createdAt)}
            </TableCell>
            <TableCell className="text-right">
              <CaseActions escalationId={item.id} status={item.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
