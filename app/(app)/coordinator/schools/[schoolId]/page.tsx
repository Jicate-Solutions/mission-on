import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireRolePage } from '@/lib/dal'
import {
  FEE_BRACKET_LABELS,
  SCHOOL_TYPE_LABELS,
  STAGE_LABELS,
  STATUS_LABELS,
  statusVariant,
} from '@/app/api/schools/_lib/pipeline.constants'
import {
  getSchool,
  listSchoolSessions,
} from '@/app/api/schools/_lib/pipeline'
import { StageForm } from '../_components/stage-form'
import { SessionForm } from '../_components/session-form'
import { SessionsTable } from '../_components/sessions-table'

export const metadata: Metadata = { title: 'Manage school — Mission ON' }

/**
 * Coordinator: manage one of MY schools — update stage/status and capture
 * session logistics. Classification-free throughout. The DAL self-scopes a
 * coordinator to their own schools, so an unowned id returns 404.
 */
export default async function CoordinatorSchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  await requireRolePage(['coordinator', 'admin', 'super_admin'])
  const { schoolId } = await params

  const school = await getSchool(schoolId)
  if (!school) notFound()

  const sessions = await listSchoolSessions(schoolId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/coordinator/schools"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← My schools
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">{school.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{SCHOOL_TYPE_LABELS[school.type]}</Badge>
          <Badge variant="neutral">
            {FEE_BRACKET_LABELS[school.feeBracket]}
          </Badge>
          <Badge variant="brand">{STAGE_LABELS[school.pipelineStage]}</Badge>
          <Badge variant={statusVariant(school.status)}>
            {STATUS_LABELS[school.status]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline stage</CardTitle>
          </CardHeader>
          <CardContent>
            <StageForm
              schoolId={school.id}
              currentStage={school.pipelineStage}
              currentStatus={school.status}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add session logistics</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionForm schoolId={school.id} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionsTable sessions={sessions} />
        </CardContent>
      </Card>
    </div>
  )
}
