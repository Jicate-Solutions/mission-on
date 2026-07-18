'use client'

import { useActionState } from 'react'

import { signInWithCode } from '@/lib/auth/code-actions'
import type { SignInState } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: SignInState = { error: null }

export interface AccessCodeFormProps {
  /** Safe internal path to return to after login (from ?next=). */
  next?: string
}

/**
 * Client access-code form (doc/update.md §3). Submits to the signInWithCode
 * Server Action via useActionState so we get a pending state and a returned
 * error message without holding any Supabase session in the browser. On
 * success the action redirects, so this component never sees the
 * authenticated state.
 *
 * The code is a live credential (it IS the account's Supabase Auth password),
 * so the field is masked like a password and never autocompleted/cached.
 */
export function AccessCodeForm({ next }: AccessCodeFormProps) {
  const [state, formAction, pending] = useActionState(
    signInWithCode,
    initialState
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <Label htmlFor="code" required>
          Access code
        </Label>
        <Input
          id="code"
          name="code"
          type="password"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          aria-invalid={state.error ? true : undefined}
          placeholder="XXXX-XXXX-XXXX"
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
        Your access code was given to you by your program team. If you&apos;ve
        lost it, ask your Super Admin to regenerate one.
      </p>
    </form>
  )
}
