import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type { AccessCodeDto } from '@/app/(app)/super-admin/access-codes/_lib/queries'
import { roleLabel } from '@/components/roles/labels'
import { AccessCodeRow } from './access-code-row'

/**
 * Server Component roster table for issued access codes. Only the per-row
 * <AccessCodeRow> (Revoke/Regenerate) is a Client Component.
 */
export function AccessCodeRoster({ codes }: { codes: AccessCodeDto[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last used</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {codes.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium text-ink">
              {c.displayName}
            </TableCell>
            <TableCell>{roleLabel(c.role)}</TableCell>
            <TableCell>
              <Badge variant={c.status === 'active' ? 'success' : 'neutral'}>
                {c.status === 'active' ? 'Active' : 'Revoked'}
              </Badge>
            </TableCell>
            <TableCell className="text-ink-muted">
              {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : 'Never'}
            </TableCell>
            <TableCell className="text-right">
              <AccessCodeRow
                codeId={c.id}
                status={c.status}
                displayName={c.displayName}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
