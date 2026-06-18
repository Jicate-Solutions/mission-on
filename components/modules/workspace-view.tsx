// =============================================================================
// Mission ON — Smart Choices
// components/modules/workspace-view.tsx — Presentational body of the Module
// Design Workspace index (PRD §7.4). Server-safe (no client JS); the per-row
// deep-link target is parameterised by `basePath` so the admin and super_admin
// pages can share this view (super_admin has admin powers). Lists every session
// with its school's confirmed/computed module code (the planning anchor) and the
// module the admin has designed onto the session (session_design).
//
// Module codes shown here are admin/super_admin-visible by RBAC. This view is
// only ever rendered on admin/super_admin module pages.
// =============================================================================

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatCard, StatGrid } from '@/components/dashboard/stat-card'
import { SESSION_STATUS_LABELS } from '@/app/api/schools/_lib/pipeline.constants'
import { ModuleCodeBadge } from '@/components/modules/module-code-badge'
import type { WorkspaceSession } from '@/app/(app)/admin/modules/_lib/types'

function recommendedCode(s: WorkspaceSession) {
  return s.confirmedModuleCode ?? s.computedModuleCode ?? null
}

export function WorkspaceView({
  sessions,
  basePath,
}: {
  sessions: WorkspaceSession[]
  /** Deep-link base, e.g. "/admin/modules" or "/super-admin/modules". */
  basePath: string
}) {
  const designed = sessions.filter((s) => s.designedModuleCode !== null).length
  const awaiting = sessions.filter(
    (s) => s.designedModuleCode === null && recommendedCode(s) !== null
  ).length
  const unclassified = sessions.filter(
    (s) => recommendedCode(s) === null
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Module workspace</h1>
        <p className="mt-1 text-ink-muted">
          Design the delivery plan for each school&apos;s session with the
          Mentor team. The recommended code comes from the school&apos;s
          confirmed classification — visible to Admins and Super Admins only.
        </p>
      </div>

      <StatGrid>
        <StatCard label="Sessions" value={sessions.length} />
        <StatCard
          label="Designed"
          value={designed}
          tone="success"
          hint="Module attached"
        />
        <StatCard
          label="Awaiting design"
          value={awaiting}
          tone={awaiting > 0 ? 'warning' : 'success'}
          hint="Classified, not designed"
        />
        <StatCard
          label="Unclassified"
          value={unclassified}
          hint="No confirmed code yet"
        />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            {sessions.length} session{sessions.length === 1 ? '' : 's'} across
            all schools. Open one to attach its planning module and assign the
            Mentor team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-ink-muted">
              No sessions yet. Sessions appear here once a coordinator fixes one
              for a school.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recommended</TableHead>
                  <TableHead>Designed</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-ink">
                      {s.schoolName}
                    </TableCell>
                    <TableCell>{s.grade}</TableCell>
                    <TableCell>{s.sessionDate ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="neutral">
                        {SESSION_STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ModuleCodeBadge
                        code={recommendedCode(s)}
                        variant="neutral"
                      />
                    </TableCell>
                    <TableCell>
                      <ModuleCodeBadge code={s.designedModuleCode} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`${basePath}/${s.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Design
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
