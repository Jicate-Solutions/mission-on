'use client'

import { useActionState } from 'react'

import { signUp, type SignUpState } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: SignUpState = { error: null }

/**
 * Client sign-up form. Submits to the signUp Server Action via useActionState,
 * so the browser never holds a Supabase session. On success with email
 * confirmation disabled the action redirects to /pending; with confirmation
 * enabled it returns needsConfirmation and we show an inbox prompt.
 */
export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState)

  if (state.needsConfirmation) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md bg-[color-mix(in_srgb,var(--color-primary)_8%,white)] px-4 py-3 text-sm text-ink"
      >
        <p className="font-medium">Almost there — check your email.</p>
        <p className="mt-1 text-ink-muted">
          We sent a confirmation link to verify your address. Open it, then sign
          in. Your program team will allocate your access after that.
        </p>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="fullName" required>
          Full name
        </Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          aria-invalid={state.error ? true : undefined}
          placeholder="Your name"
        />
      </div>

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

      <div>
        <Label htmlFor="password" required>
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={state.error ? true : undefined}
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <Label htmlFor="confirmPassword" required>
          Confirm password
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={state.error ? true : undefined}
          placeholder="Re-enter your password"
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
        {pending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        New accounts are reviewed by your program team before you receive access.
      </p>
    </form>
  )
}
