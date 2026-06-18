'use client'

import { useActionState } from 'react'

import { requestPasswordReset, type ResetRequestState } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: ResetRequestState = { error: null, sent: false }

/**
 * Forgot-password form. Submits to requestPasswordReset. The success state is
 * deliberately NEUTRAL — it never confirms whether the email has an account.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  )

  if (state.sent) {
    return (
      <p
        role="status"
        className="rounded-md bg-[color-mix(in_srgb,var(--color-success)_10%,white)] px-3 py-3 text-sm text-ink"
      >
        If an account exists for that email, we&apos;ve sent a link to reset
        your password. Check your inbox (and spam).
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          aria-invalid={state.error ? true : undefined}
          placeholder="you@example.com"
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
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  )
}
