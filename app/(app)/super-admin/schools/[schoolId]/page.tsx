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
  listCoordinatorOptions,
  listSchoolSessions,
} from '@/app/api/schools/_lib/pipeline'
// Reused interactive + presentational pieces (shared coordinator/admin modules).
import { StageForm } from '@/app/(app)/coordinator/schools/_components/stage-form'
import { SessionForm } from '@/app/(app)/coordinator/schools/_components/session-form'
import { SessionsTable } from '@/app/(app)/coordinator/schools/_components/sessions-table'
import { AssignCoordinatorForm } from '@/app/(app)/admin/schools/_components/assign-coordinator-form'

export const metadata: Metadata = { title: 'School — Mission ON' }

/**
 * Super Admin: full pipeline management for one school — the super_admin mirror
 * of the admin school detail. Reuses the admin/coordinator pipeline modules and
 * data layer (is_admin_role covers super_admin). Classification-FREE: the module
 * code is designed elsewhere; admins manage logistics here.
 */
export default async function SuperAdminSchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  await requireRolePage(['super_admin'])
  const { schoolId } = await params

  const [school, sessions, coordinators] = await Promise.all([
    getSchool(schoolId),
    listSchoolSessions(schoolId),
    listCoordinatorOptions(),
  ])

  if (!school) notFound()

  const coordinatorChoices = coordinators.map((c) => ({
    userId: c.userId,
    label: c.label,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/super-admin/schools"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Schools
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
            <CardTitle>Coordinator</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignCoordinatorForm
              schoolId={school.id}
              currentCoordinatorId={school.coordinatorId}
              coordinators={coordinatorChoices}
            />
          </CardContent>
        </Card>

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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add session logistics</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionForm schoolId={school.id} />
        </CardContent>
      </Card>

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
