'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'

import { setMentorActive } from './_lib/actions'

/**
 * Inline activate/deactivate control for the admin mentor directory. Submits a
 * Server Action (setMentorActive) which re-verifies admin internally; this
 * component holds NO sensitive data, only the public mentor id + active flag.
 */
export function MentorActiveToggle({
  mentorPublicId,
  isActive,
}: {
  mentorPublicId: string
  isActive: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)

  function onToggle() {
    setError(null)
    const fd = new FormData()
    fd.set('mentorPublicId', mentorPublicId)
    fd.set('isActive', String(!isActive))
    startTransition(async () => {
      const res = await setMentorActive(fd)
      if (!res.ok) setError(res.error ?? 'Failed.')
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant={isActive ? 'outline' : 'secondary'}
        size="sm"
        onClick={onToggle}
        disabled={pending}
        aria-label={isActive ? 'Deactivate mentor' : 'Activate mentor'}
      >
        {pending ? '…' : isActive ? 'Deactivate' : 'Activate'}
      </Button>
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  )
}
