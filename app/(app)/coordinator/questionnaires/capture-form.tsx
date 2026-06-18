'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { TemplateQuestion } from '@/types/database'

import {
  submitQuestionnaireResponses,
  type QuestionnaireActionState,
} from './actions'

const INITIAL: QuestionnaireActionState = { ok: false, error: null, message: null }

export interface CaptureFormProps {
  schoolId: string
  questions: TemplateQuestion[]
  /** Previously captured answers (question id -> chosen value). */
  answers: Record<string, string>
  /** Disable inputs when the questionnaire is already confirmed/locked. */
  readOnly?: boolean
}

/**
 * Fixed-form response capture. Submits to the submitQuestionnaireResponses
 * Server Action. The action computes + stores the classification server-side and
 * returns ONLY a neutral lifecycle message — this component never receives a
 * module code, by design.
 */
export function CaptureForm({
  schoolId,
  questions,
  answers,
  readOnly = false,
}: CaptureFormProps) {
  const [state, formAction, pending] = useActionState(
    submitQuestionnaireResponses,
    INITIAL
  )

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="schoolId" value={schoolId} />

      {questions.map((q, i) => (
        <div key={q.id} className="flex flex-col gap-1.5">
          <Label htmlFor={`q_${q.id}`}>
            {i + 1}. {q.text}
          </Label>
          <Select
            id={`q_${q.id}`}
            name={`q_${q.id}`}
            defaultValue={answers[q.id] ?? ''}
            disabled={readOnly || pending}
          >
            <option value="">— Select —</option>
            {q.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}

      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      {state.ok && state.message ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-success)_12%,white)] px-3 py-2 text-sm text-success"
        >
          {state.message}
        </p>
      ) : null}

      {!readOnly ? (
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save responses'}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
