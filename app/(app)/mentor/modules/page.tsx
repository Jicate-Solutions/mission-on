import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireRolePage } from '@/lib/dal'
import { SESSION_STATUS_LABELS } from '@/app/api/schools/_lib/pipeline.constants'

import { getMentorModules, type MentorModuleSession } from './_data'

export const metadata: Metadata = { title: 'My modules — Mentor — Mission ON' }

// Per-user data: always server-rendered, never cached.
export const dynamic = 'force-dynamic'

function formatTime(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

/**
 * Mentor read-only "My modules" view (PRD §7.4, §9.4). Lists the sessions for
 * the schools this mentor is allocated to — logistics only. The module CODE and
 * classification are Admin/Super-Admin-only by RBAC and are NOT shown here.
 * Double-gated: mentor route-group layout + requireRolePage + the data call
 * re-verifies internally.
 */
export default async function MentorModulesPage() {
  await requireRolePage(['mentor'])

  const view = await getMentorModules()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">My modules</h1>
        <p className="mt-1 text-ink-muted">
          The sessions you support, grouped by school, with the delivery brief
          the Admin team prepared for each. (The internal module code is
          intentionally not shown here.)
        </p>
      </div>

      {!view.hasProfile ? (
        <Card>
          <CardHeader>
            <CardTitle>Finish setting up your profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-ink-muted">
              You don&apos;t have a mentor profile and alias yet. Set one up so
              the Admin team can allocate you to schools.
            </p>
            <Link
              href="/mentor/profile"
              className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Go to profile
            </Link>
          </CardContent>
        </Card>
      ) : view.schools.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No modules yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-ink-muted">
              You are not allocated to any school yet. Once the Admin team
              assigns you to a school&apos;s module, its sessions appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        view.schools.map((school) => (
          <Card key={school.schoolId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {school.schoolName}
                <Badge variant="neutral">
                  {school.sessions.length} session
                  {school.sessions.length === 1 ? '' : 's'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Sessions you support at this school.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {school.sessions.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No sessions fixed for this school yet.
                </p>
              ) : (
                school.sessions.map((s) => (
                  <SessionBlock key={s.id} session={s} />
                ))
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

/** One session with its delivery brief (no module code). */
function SessionBlock({ session }: { session: MentorModuleSession }) {
  const { brief } = session
  const fields: Array<{ label: string; value: string | null }> = [
    { label: 'Learning Facilitator', value: brief.learningFacilitator },
    { label: 'Media / film', value: brief.mediaFilm },
    { label: 'Demonstration', value: brief.demonstration },
    { label: 'Conversation framework', value: brief.conversationFramework },
    { label: 'Escalation pathway', value: brief.escalationPathway },
    { label: 'Notes', value: brief.notes },
  ].filter((f) => f.value && f.value.trim().length > 0)

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">Grade {session.grade}</span>
        <span className="text-sm text-ink-muted">
          {session.sessionDate ?? 'date TBC'}
          {formatTime(session.startTime) ? ` · ${formatTime(session.startTime)}` : ''}
        </span>
        <Badge variant="neutral">{SESSION_STATUS_LABELS[session.status]}</Badge>
      </div>

      {fields.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">
          No delivery brief yet — the Admin team is still preparing it.
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="text-xs font-medium text-ink-muted">{f.label}</dt>
              <dd className="whitespace-pre-wrap break-words text-sm text-ink">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
