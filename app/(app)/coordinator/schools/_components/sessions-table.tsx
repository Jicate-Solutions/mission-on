// Presentational session-logistics table (Server Component — no interactivity).
// Renders classification-FREE session rows. NO module code is ever present on
// the SessionLogisticsRow type, so none can be rendered here.

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SESSION_STATUS_LABELS } from '@/app/api/schools/_lib/pipeline.constants'
import type { SessionLogisticsRow } from '@/app/api/schools/_lib/pipeline'

function dash(v: string | number | null): string {
  return v === null || v === '' ? '—' : String(v)
}

export function SessionsTable({
  sessions,
}: {
  sessions: SessionLogisticsRow[]
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No session logistics recorded yet.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Grade</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Day</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Expected</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{dash(s.grade)}</TableCell>
            <TableCell>{dash(s.sessionDate)}</TableCell>
            <TableCell>{dash(s.dayOfWeek)}</TableCell>
            <TableCell>{dash(s.startTime)}</TableCell>
            <TableCell>{dash(s.expectedStrength)}</TableCell>
            <TableCell>
              <Badge variant="info">
                {SESSION_STATUS_LABELS[s.status]}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
