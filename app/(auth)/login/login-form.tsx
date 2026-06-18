'use client'

import { useActionState } from 'react'

import { signIn, type SignInState } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: SignInState = { error: null }

export interface LoginFormProps {
  /** Safe internal path to return to after login (from ?next=). */
  next?: string
}

/**
 * Client login form. Submits to the signIn Server Action via useActionState so
 * we get a pending state and a returned error message without holding any
 * Supabase session in the browser. On success the action redirects, so this
 * component never sees the authenticated state.
 */
export function LoginForm({ next }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signIn, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

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
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
          placeholder="Your password"
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
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        Accounts are created by your program team. If you cannot sign in, ask
        your coordinator or mentor for help.
      </p>
    </form>
  )
}
