import type { Metadata } from 'next'

import { listAuditLog, type AuditLogDTO } from './_data'
import { requireRole } from '@/lib/dal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata: Metadata = { title: 'Audit log — Mission ON' }

// Sensitive oversight surface — never cache.
export const dynamic = 'force-dynamic'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type BadgeVariant = 'neutral' | 'info' | 'warning' | 'success' | 'brand' | 'danger'

/** Colour the action by its category so the log scans quickly. */
function actionVariant(action: string): BadgeVariant {
  if (action.startsWith('safeguarding') || action === 'identity.reveal') return 'danger'
  if (action.startsWith('role')) return 'info'
  if (action.startsWith('classification')) return 'brand'
  if (action.endsWith('.provision')) return 'success'
  return 'neutral'
}

function formatMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata)
  if (entries.length === 0) return '—'
  return entries
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ')
}

function shortId(id: string | null): string {
  return id ? `${id.slice(0, 8)}…` : '—'
}

/**
 * Super Admin audit-log viewer (PRD §13 / §9.1, Phase 5). Read-only over the
 * append-only audit_logs table. Authorization is enforced in the DAL
 * (requireRole(['super_admin'])) and by RLS (audit_super_admin_select), not the
 * URL — the super-admin layout gate is only the first of three layers.
 */
export default async function AuditLogPage() {
  await requireRole(['super_admin'])
  const entries = await listAuditLog()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Audit log</h1>
        <p className="mt-1 text-ink-muted">
          An append-only record of sensitive actions — classification access, role
          changes, identity provisioning, safeguarding escalations, and
          moderation. Showing the {entries.length} most recent entries.
        </p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-ink-muted">
            No audit entries yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <AuditRow key={e.id} entry={e} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditLogDTO }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-ink-muted">
        {formatWhen(entry.createdAt)}
      </TableCell>
      <TableCell className="text-sm text-ink">
        {entry.actorEmail ?? (
          <span className="font-mono text-xs text-ink-muted">
            {shortId(entry.actorId)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>
      </TableCell>
      <TableCell className="text-xs text-ink-muted">
        {entry.entityType ? (
          <span>
            {entry.entityType}{' '}
            <span className="font-mono">{shortId(entry.entityId)}</span>
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="max-w-md break-words text-xs text-ink-muted">
        {formatMetadata(entry.metadata)}
      </TableCell>
    </TableRow>
  )
}
