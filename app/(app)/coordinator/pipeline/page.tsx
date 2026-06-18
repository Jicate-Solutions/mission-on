import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireRolePage } from '@/lib/dal'
import {
  FEE_BRACKET_LABELS,
  STAGE_LABELS,
  STATUS_LABELS,
  statusVariant,
} from '@/app/api/schools/_lib/pipeline.constants'
import { getOwnPipelineBoard } from './_data'

export const metadata: Metadata = { title: 'Pipeline — Mission ON' }

export const dynamic = 'force-dynamic'

/**
 * Coordinator pipeline board (PRD §9.3). The coordinator's OWN schools, grouped
 * by pipeline stage, each showing its current status. Classification is NEVER
 * shown — the board carries only stage + status (the SchoolPipelineRow shape has
 * no module/classification fields). Page is dynamic (per-user).
 */
export default async function CoordinatorPipelinePage() {
  await requireRolePage(['coordinator'])
  const board = await getOwnPipelineBoard()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Pipeline board</h1>
        <p className="mt-1 text-ink-muted">
          Your schools, grouped by stage. You see the status of each school you
          run — classification results stay with Admins.
        </p>
      </div>

      {board.total === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-ink-muted">
              No schools are assigned to you yet. An Admin assigns you to a
              school when it is created.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {board.columns.map((col) => (
            <Card key={col.stage} className="flex flex-col">
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {STAGE_LABELS[col.stage]}
                </CardTitle>
                <Badge variant="neutral">{col.schools.length}</Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2">
                {col.schools.length === 0 ? (
                  <p className="text-sm text-ink-muted">No schools here.</p>
                ) : (
                  col.schools.map((s) => (
                    <Link
                      key={s.id}
                      href={`/coordinator/schools/${s.id}`}
                      className="flex flex-col gap-1 rounded-md border border-border bg-surface p-3 transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="font-medium text-ink">{s.name}</span>
                      <span className="text-xs text-ink-muted">
                        {FEE_BRACKET_LABELS[s.feeBracket]}
                      </span>
                      <Badge
                        variant={statusVariant(s.status)}
                        className="mt-1 w-fit"
                      >
                        {STATUS_LABELS[s.status]}
                      </Badge>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
