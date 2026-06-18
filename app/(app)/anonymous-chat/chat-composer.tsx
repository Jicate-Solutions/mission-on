'use client'

import { useActionState, useEffect, useRef } from 'react'

import { postAnonymous, type PostState } from '@/app/(app)/anonymous-chat/actions'
import { ANON_MAX_BODY } from '@/app/(app)/anonymous-chat/anon-dal-constants'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const initialState: PostState = { error: null, ok: false }

/**
 * Anonymous post composer. Submits to the postAnonymous Server Action. We never
 * collect or send any identity — the body is the only field. The server stores a
 * one-way rate-limit hash, not the user.
 */
export function ChatComposer() {
  const [state, action, pending] = useActionState(postAnonymous, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state.ok])

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="anon-body">Share a thought — anonymously</Label>
        <Textarea
          id="anon-body"
          name="body"
          maxLength={ANON_MAX_BODY}
          required
          placeholder="No names are stored here. Be kind, and keep others safe."
          aria-invalid={state.error ? true : undefined}
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Posts are not attributed to anyone. Harmful posts may be hidden by
          moderators.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? 'Posting…' : 'Post anonymously'}
        </Button>
      </div>
    </form>
  )
}
