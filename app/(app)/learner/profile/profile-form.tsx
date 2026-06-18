'use client'

import { useActionState } from 'react'

import { updateLearnerProfile, type ProfileState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: ProfileState = { error: null, success: null }

/**
 * Editable part of the learner profile: alias + contact number. Submits the
 * updateLearnerProfile Server Action (which re-verifies the learner role and
 * writes only the caller's own rows under RLS).
 */
export function ProfileForm({
  alias,
  contactNumber,
}: {
  alias: string
  contactNumber: string | null
}) {
  const [state, action, pending] = useActionState(
    updateLearnerProfile,
    initialState
  )

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="alias">Alias</Label>
        <Input
          id="alias"
          name="alias"
          defaultValue={alias}
          maxLength={40}
          required
          aria-invalid={state.error ? true : undefined}
        />
        <p className="mt-1 text-xs text-ink-muted">
          This is the name mentors and others see — please don&apos;t use your
          real name.
        </p>
      </div>

      <div>
        <Label htmlFor="contactNumber">Contact number</Label>
        <Input
          id="contactNumber"
          name="contactNumber"
          type="tel"
          defaultValue={contactNumber ?? ''}
          maxLength={20}
          placeholder="Optional"
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-success">
          {state.success}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}
