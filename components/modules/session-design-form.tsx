'use client'

// =============================================================================
// Mission ON — Smart Choices
// components/modules/session-design-form.tsx — Admin control to attach the
// planning module code to a session (PRD §7.4). Submits the
// setSessionModuleDesign Server Action, which re-verifies admin internally and
// UPSERTs the admin-only session_design.module_code. Holds only the session id
// and module code (admin-visible, non-sensitive).
// =============================================================================

import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ALL_MODULE_CODES,
  schoolProfile,
  usageProfile,
} from '@/components/modules/module-labels'
import type { ModuleCode } from '@/types/database'
import type { DeliveryPlan } from '@/app/(app)/admin/modules/_lib/types'

import { setSessionModuleDesign } from '@/app/(app)/admin/modules/_lib/actions'

/** The free-text brief fields, in display order, with labels + helper copy. */
const PLAN_FIELDS: ReadonlyArray<{
  key: keyof DeliveryPlan
  label: string
  hint: string
}> = [
  { key: 'mediaFilm', label: 'Media / film', hint: 'Which film or media to screen.' },
  { key: 'demonstration', label: 'Demonstration', hint: 'The hands-on demo to run.' },
  {
    key: 'conversationFramework',
    label: 'Conversation framework',
    hint: 'How the mentor opens and guides the discussion.',
  },
  {
    key: 'escalationPathway',
    label: 'Escalation pathway',
    hint: 'What to do if a learner discloses something serious.',
  },
  { key: 'notes', label: 'Notes', hint: 'Anything else the team should know.' },
]

export function SessionDesignForm({
  sessionId,
  designedModuleCode,
  recommendedModuleCode,
  plan,
}: {
  sessionId: string
  /** The module code currently attached to the session (session_design). */
  designedModuleCode: ModuleCode | null
  /** The school's confirmed/computed code, suggested as the planning anchor. */
  recommendedModuleCode: ModuleCode | null
  /** The delivery plan (brief) currently saved for this session. */
  plan: DeliveryPlan
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)
  const [code, setCode] = React.useState<string>(designedModuleCode ?? '')
  const [fields, setFields] = React.useState<Record<keyof DeliveryPlan, string>>({
    mediaFilm: plan.mediaFilm ?? '',
    demonstration: plan.demonstration ?? '',
    conversationFramework: plan.conversationFramework ?? '',
    escalationPathway: plan.escalationPathway ?? '',
    learningFacilitator: plan.learningFacilitator ?? '',
    notes: plan.notes ?? '',
  })

  function setField(key: keyof DeliveryPlan, value: string) {
    setFields((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  function onSave() {
    setError(null)
    setSaved(false)
    const fd = new FormData()
    fd.set('sessionId', sessionId)
    fd.set('moduleCode', code)
    for (const key of Object.keys(fields) as Array<keyof DeliveryPlan>) {
      fd.set(key, fields[key])
    }
    startTransition(async () => {
      const res = await setSessionModuleDesign(fd)
      if (!res.ok) setError(res.error ?? 'Could not save the module design.')
      else setSaved(true)
    })
  }

  function applyRecommended() {
    if (recommendedModuleCode) setCode(recommendedModuleCode)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning module</CardTitle>
        <CardDescription>
          Attach the module code that anchors the delivery plan for this
          session. The recommendation comes from the school&apos;s confirmed
          classification — accept it, or override after designing with the
          Mentor team.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="design-module">Module code</Label>
            <Select
              id="design-module"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setSaved(false)
              }}
              disabled={pending}
            >
              <option value="">Not designed yet</option>
              {ALL_MODULE_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={onSave} disabled={pending}>
            {pending ? 'Saving…' : 'Save design'}
          </Button>
        </div>

        {recommendedModuleCode ? (
          <p className="text-sm text-ink-muted">
            Recommended for this school:{' '}
            <span className="font-medium text-ink">
              {recommendedModuleCode}
            </span>
            {code !== recommendedModuleCode ? (
              <>
                {' '}
                <button
                  type="button"
                  onClick={applyRecommended}
                  disabled={pending}
                  className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
                >
                  Use recommended
                </button>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            This school has no confirmed classification yet — confirm the
            questionnaire first to get a recommendation.
          </p>
        )}

        {code ? (
          <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
            <p className="font-medium text-ink">{code}</p>
            <p className="mt-1 text-ink-muted">School: {schoolProfile(code as ModuleCode)}</p>
            <p className="text-ink-muted">Usage: {usageProfile(code as ModuleCode)}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 border-t border-border pt-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">Delivery plan</h3>
            <p className="text-xs text-ink-muted">
              The brief the mentor team delivers. Assigned mentors can view this
              brief — but never the module code.
            </p>
          </div>

          <div>
            <Label htmlFor="plan-facilitator">Learning Facilitator</Label>
            <Input
              id="plan-facilitator"
              value={fields.learningFacilitator}
              onChange={(e) => setField('learningFacilitator', e.target.value)}
              disabled={pending}
              placeholder="JKKN faculty anchor for this session"
            />
          </div>

          {PLAN_FIELDS.map((f) => (
            <div key={f.key}>
              <Label htmlFor={`plan-${f.key}`}>{f.label}</Label>
              <Textarea
                id={`plan-${f.key}`}
                value={fields[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                disabled={pending}
                placeholder={f.hint}
                rows={2}
              />
            </div>
          ))}

          <Button onClick={onSave} disabled={pending} className="w-fit">
            {pending ? 'Saving…' : 'Save design'}
          </Button>
        </div>

        {saved ? (
          <p className="text-sm text-success" role="status">
            Module design saved.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
