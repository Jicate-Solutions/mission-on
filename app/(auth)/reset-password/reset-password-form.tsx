'use client'

import { useActionState } from 'react'

import { updatePassword, type UpdatePasswordState } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: UpdatePasswordState = { error: null }

/**
 * Set-new-password form. Submits to updatePassword (which requires the recovery
 * session established via /auth/callback). On success the action redirects.
 */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="password" required>
          New password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={state.error ? true : undefined}
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword" required>
          Confirm new password
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={state.error ? true : undefined}
          placeholder="Re-enter your new password"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  )
}
