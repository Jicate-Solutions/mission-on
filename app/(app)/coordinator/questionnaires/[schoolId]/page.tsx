import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { getCoordinatorQuestionnaireForSchool } from '../_data'
import { QuestionnaireStatusBadge } from '../status-badge'
import { IssueForm } from '../issue-form'
import { CaptureForm } from '../capture-form'

export const metadata: Metadata = {
  title: 'Manage questionnaire — Coordinator — Mission ON',
}

export const dynamic = 'force-dynamic'

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * Coordinator view of one school's questionnaire: issue it, then capture the
 * fixed-form responses. Classification is NEVER surfaced here — the data layer
 * and the submit action keep the computed module code on the admin side only.
 */
export default async function CoordinatorQuestionnaireDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  const detail = await getCoordinatorQuestionnaireForSchool(schoolId)

  if (!detail) notFound()

  const issued = detail.responseId !== null
  const locked = detail.status === 'confirmed'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/coordinator/questionnaires"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← All questionnaires
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          {detail.schoolName}
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <QuestionnaireStatusBadge status={detail.status} />
          {detail.issuedAt ? (
            <span className="text-sm text-ink-muted">
              Issued {fmtDateTime(detail.issuedAt)}
            </span>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issue questionnaire</CardTitle>
          <CardDescription>
            Send the fixed pre-session questionnaire to this school (target: ~1
            week before the session).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IssueForm schoolId={detail.schoolId} alreadyIssued={issued} />
        </CardContent>
      </Card>

      {detail.template ? (
        <Card>
          <CardHeader>
            <CardTitle>{detail.template.title}</CardTitle>
            <CardDescription>
              {issued
                ? 'Record the school’s answers below. Your responses are saved and scored automatically; the resulting module is reviewed by Admins and is not shown to you.'
                : 'Issue the questionnaire first, then capture the school’s answers here.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {locked ? (
              <p className="mb-4 rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted">
                This questionnaire has been confirmed by an Admin and is locked.
              </p>
            ) : null}
            <CaptureForm
              schoolId={detail.schoolId}
              questions={detail.template.questions}
              answers={detail.answers}
              readOnly={!issued || locked}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-ink-muted">
              No active questionnaire template is configured. Ask an Admin to
              activate one.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
