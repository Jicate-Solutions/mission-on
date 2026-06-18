import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { requireRolePage } from '@/lib/dal'
import {
  FEE_BRACKET_LABELS,
  PIPELINE_STAGES,
  STAGE_LABELS,
  STATUS_LABELS,
  statusVariant,
} from '@/app/api/schools/_lib/pipeline.constants'
import {
  getCoordinatorLabelMap,
  listAllSchoolsForBoard,
} from '@/app/api/schools/_lib/pipeline'

export const metadata: Metadata = { title: 'Schools — Mission ON' }

/**
 * Super Admin pipeline board — the super_admin mirror of the admin schools
 * board. Reuses the admin pipeline data layer (is_admin_role covers super_admin)
 * and links into the super-admin namespace. Classification-FREE: module codes
 * live on the classification pages, not here.
 */
export default async function SuperAdminSchoolsPage() {
  await requireRolePage(['super_admin'])

  const [schools, coordinatorLabels] = await Promise.all([
    listAllSchoolsForBoard(),
    getCoordinatorLabelMap(),
  ])

  function coordinatorName(id: string | null): string {
    if (!id) return 'Unassigned'
    return coordinatorLabels.get(id) ?? `Coordinator ${id.slice(0, 8)}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Schools</h1>
          <p className="mt-1 text-ink-muted">
            The pipeline board across all schools. Create schools, assign
            coordinators, and track every stage.
          </p>
        </div>
        <Link
          href="/super-admin/schools/new"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-brand-700 active:bg-brand-800"
        >
          New school
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        {PIPELINE_STAGES.map((stage) => {
          const inStage = schools.filter((s) => s.pipelineStage === stage)
          return (
            <Card key={stage}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {STAGE_LABELS[stage]}
                  <Badge variant="neutral">{inStage.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inStage.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    No schools at this stage.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>School</TableHead>
                        <TableHead>Fee bracket</TableHead>
                        <TableHead>Coordinator</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inStage.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-ink">
                            {s.name}
                          </TableCell>
                          <TableCell>
                            {FEE_BRACKET_LABELS[s.feeBracket]}
                          </TableCell>
                          <TableCell>
                            {coordinatorName(s.coordinatorId)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(s.status)}>
                              {STATUS_LABELS[s.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/super-admin/schools/${s.id}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              Open
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
