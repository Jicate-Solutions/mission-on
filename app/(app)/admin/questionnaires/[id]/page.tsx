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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { writeAudit } from '@/lib/dal'
import type { TemplateQuestion } from '@/types/database'

import { getAdminQuestionnaireDetail } from '../_data'
import { QuestionnaireStatusBadge } from '../../../coordinator/questionnaires/status-badge'
import { ConfirmModuleForm } from '../confirm-form'

export const metadata: Metadata = {
  title: 'Questionnaire result — Admin — Mission ON',
}

export const dynamic = 'force-dynamic'

function answerLabel(q: TemplateQuestion, value: string | undefined): string {
  if (value === undefined) return '— No answer —'
  const opt = q.options.find((o) => o.value === value)
  return opt?.label ?? value
}

function answerCode(q: TemplateQuestion, value: string | undefined): string | null {
  if (value === undefined) return null
  const opt = q.options.find((o) => o.value === value)
  return opt?.code ?? null
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * ADMIN / SUPER_ADMIN classification detail (PRD §6.5 OUTPUT). Shows the module
 * code, confidence, flags and RAW responses, and offers the divergence-confirm
 * action. The data layer re-verifies the admin role; this page additionally
 * writes a classification.read audit entry (PRD §13) on each actual view.
 */
export default async function AdminQuestionnaireDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getAdminQuestionnaireDetail(id)

  if (!detail) notFound()

  // Audit the classification access (admin read a module code). PRD §13.
  await writeAudit({
    action: 'classification.read',
    entityType: 'questionnaire_responses',
    entityId: detail.id,
    metadata: {
      school_id: detail.schoolId,
      computed_module_code: detail.computedModuleCode,
      confirmed_module_code: detail.confirmedModuleCode,
    },
  })

  const confidencePct =
    detail.confidence === null ? null : Math.round(detail.confidence * 100)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/questionnaires"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← All results
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          {detail.schoolName}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <QuestionnaireStatusBadge status={detail.status} />
          <span className="text-sm text-ink-muted">
            {detail.templateTitle} (v{detail.templateVersion})
          </span>
        </div>
      </div>

      {/* Classification summary — admin/super_admin only. */}
      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
          <CardDescription>
            Computed from the school’s responses. Visible to Admins and Super
            Admins only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-ink-muted">Computed module</dt>
              <dd className="mt-1">
                {detail.computedModuleCode ? (
                  <Badge variant="info">{detail.computedModuleCode}</Badge>
                ) : (
                  <span className="text-ink-muted">Not yet computed</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Confirmed module</dt>
              <dd className="mt-1">
                {detail.confirmedModuleCode ? (
                  <Badge variant="brand">{detail.confirmedModuleCode}</Badge>
                ) : (
                  <span className="text-ink-muted">Not confirmed</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Confidence</dt>
              <dd className="mt-1 text-ink">
                {confidencePct === null ? '—' : `${confidencePct}%`}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Divergence</dt>
              <dd className="mt-1">
                {detail.divergenceFlag ? (
                  <Badge variant="warning">Flagged</Badge>
                ) : (
                  <Badge variant="success">None</Badge>
                )}
              </dd>
            </div>
          </dl>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-ink-muted">Category A (computed)</dt>
              <dd className="mt-1 text-ink">{detail.computedACode ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Category B (computed)</dt>
              <dd className="mt-1 text-ink">{detail.computedBCode ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Completed</dt>
              <dd className="mt-1 text-ink">
                {fmtDateTime(detail.completedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Confirmed</dt>
              <dd className="mt-1 text-ink">
                {detail.confirmedModuleCode
                  ? fmtDateTime(detail.confirmedAt)
                  : '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Divergence-confirm / module lock. */}
      <Card>
        <CardHeader>
          <CardTitle>Confirm module code</CardTitle>
          <CardDescription>
            Accept the computed code or override it (e.g. after resolving a
            divergence flag). Confirming locks the module and writes an audit
            entry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmModuleForm
            responseId={detail.id}
            computedModuleCode={detail.computedModuleCode}
            confirmedModuleCode={detail.confirmedModuleCode}
            divergenceFlag={detail.divergenceFlag}
          />
        </CardContent>
      </Card>

      {/* Raw responses. */}
      <Card>
        <CardHeader>
          <CardTitle>Raw responses</CardTitle>
          <CardDescription>
            The school’s answers to the fixed questionnaire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.questions.length === 0 ? (
            <p className="text-ink-muted">
              Template definition unavailable; cannot render raw responses.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead>Signal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.questions.map((q) => {
                  const value = detail.answers[q.id]
                  const code = answerCode(q, value)
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="max-w-md">{q.text}</TableCell>
                      <TableCell>
                        <Badge variant="neutral">{q.category}</Badge>
                      </TableCell>
                      <TableCell>{answerLabel(q, value)}</TableCell>
                      <TableCell>
                        {code ? (
                          <Badge variant="neutral">{code}</Badge>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
