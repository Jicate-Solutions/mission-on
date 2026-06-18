// =============================================================================
// Mission ON — Smart Choices
// components/modules/session-design-view.tsx — Presentational body of one
// session's Module Design (PRD §7.4). Server-safe shell that composes the two
// admin controls (SessionDesignForm + MentorTeamManager, both client). The
// "Back" link target is parameterised by `basePath` so admin and super_admin
// pages share this view. Module codes are admin/super_admin-visible by RBAC;
// mentors are surfaced ALIAS-ONLY.
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
import { SESSION_STATUS_LABELS } from '@/app/api/schools/_lib/pipeline.constants'
import { ModuleCodeBadge } from '@/components/modules/module-code-badge'
import { SessionDesignForm } from '@/components/modules/session-design-form'
import { MentorTeamManager } from '@/components/modules/mentor-team-manager'
import {
  schoolProfile,
  usageProfile,
} from '@/components/modules/module-labels'
import type { SessionDesignDetail } from '@/app/(app)/admin/modules/_lib/types'

function formatTime(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

export function SessionDesignView({
  detail,
  basePath,
}: {
  detail: SessionDesignDetail
  /** Deep-link base, e.g. "/admin/modules" or "/super-admin/modules". */
  basePath: string
}) {
  const { session, plan, assignedMentors, availableMentors } = detail
  const recommended =
    session.confirmedModuleCode ?? session.computedModuleCode ?? null
  const effective = session.designedModuleCode ?? recommended

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={basePath}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← Back to module workspace
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">
            {session.schoolName}
          </h1>
          <Badge variant="neutral">Grade {session.grade}</Badge>
          <Badge variant="neutral">
            {SESSION_STATUS_LABELS[session.status]}
          </Badge>
        </div>
        <p className="text-ink-muted">
          Module design for this session. The plan anchors on the module code —
          confidential to Admins and Super Admins.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            Logistics fixed by the school coordinator. The module classification
            below is admin/super_admin-only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-ink-muted">Date</dt>
              <dd className="text-ink">{session.sessionDate ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-muted">Time</dt>
              <dd className="text-ink">
                {formatTime(session.startTime) || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-muted">
                Recommended code
              </dt>
              <dd className="text-ink">
                <ModuleCodeBadge code={recommended} variant="neutral" />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-ink-muted">
                Designed code
              </dt>
              <dd className="text-ink">
                <ModuleCodeBadge code={session.designedModuleCode} />
              </dd>
            </div>
          </dl>

          {effective ? (
            <div className="mt-5 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
              <p className="font-medium text-ink">
                Module profile · {effective}
              </p>
              <p className="mt-1 text-ink-muted">
                School: {schoolProfile(effective)}
              </p>
              <p className="text-ink-muted">Usage: {usageProfile(effective)}</p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-ink-muted">
              This school has no confirmed classification yet. Confirm the
              questionnaire to surface a recommended module code.
            </p>
          )}
        </CardContent>
      </Card>

      <SessionDesignForm
        sessionId={session.id}
        designedModuleCode={session.designedModuleCode}
        recommendedModuleCode={recommended}
        plan={plan}
      />

      <MentorTeamManager
        sessionId={session.id}
        assignedMentors={assignedMentors}
        availableMentors={availableMentors}
      />
    </div>
  )
}
