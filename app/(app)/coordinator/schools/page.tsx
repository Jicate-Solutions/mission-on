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
  STAGE_LABELS,
  STATUS_LABELS,
  statusVariant,
} from '@/app/api/schools/_lib/pipeline.constants'
import { listOwnSchools } from '@/app/api/schools/_lib/pipeline'

export const metadata: Metadata = { title: 'My schools — Mission ON' }

/**
 * Coordinator: list of MY schools with current stage + status. Classification is
 * never shown — coordinators only run the pipeline. Page is dynamic (per-user).
 */
export default async function CoordinatorSchoolsPage() {
  await requireRolePage(['coordinator', 'admin', 'super_admin'])
  const schools = await listOwnSchools()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My schools</h1>
        <p className="mt-1 text-ink-muted">
          Move each school through the pipeline stages. You do not see
          classification results — that stays with Admins.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {schools.length === 0 ? (
            <p className="text-ink-muted">
              No schools are assigned to you yet. An Admin assigns you to a
              school when it is created.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Fee bracket</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-ink">
                      {s.name}
                    </TableCell>
                    <TableCell>{FEE_BRACKET_LABELS[s.feeBracket]}</TableCell>
                    <TableCell>
                      <Badge variant="brand">
                        {STAGE_LABELS[s.pipelineStage]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.status)}>
                        {STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/coordinator/schools/${s.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Manage
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
