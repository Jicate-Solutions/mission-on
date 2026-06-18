'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'

import {
  issueQuestionnaire,
  type QuestionnaireActionState,
} from './actions'

const INITIAL: QuestionnaireActionState = { ok: false, error: null, message: null }

/**
 * Issue / re-issue the active questionnaire to a school. Lifecycle only — no
 * classification is involved or returned.
 */
export function IssueForm({
  schoolId,
  alreadyIssued,
}: {
  schoolId: string
  alreadyIssued: boolean
}) {
  const [state, formAction, pending] = useActionState(issueQuestionnaire, INITIAL)

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <input type="hidden" name="schoolId" value={schoolId} />

      <Button type="submit" variant={alreadyIssued ? 'outline' : 'primary'} disabled={pending}>
        {pending
          ? 'Issuing…'
          : alreadyIssued
            ? 'Re-issue questionnaire'
            : 'Issue questionnaire'}
      </Button>

      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          className="text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p role="status" aria-live="polite" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
