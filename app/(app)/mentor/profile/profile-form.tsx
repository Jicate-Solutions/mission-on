'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { updateOwnProfile } from './_lib/actions'

/**
 * Edit form for the mentor's own contact fields. Submits the updateOwnProfile
 * Server Action, which re-verifies the caller is a mentor and resolves their
 * own profile from the session. No identity of other mentors is reachable.
 */
export function ProfileForm({
  phone,
  college,
  course,
}: {
  phone: string | null
  college: string | null
  course: string | null
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateOwnProfile(fd)
      if (!res.ok) setError(res.error ?? 'Could not save.')
      else setSaved(true)
    })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ''}
          placeholder="e.g. +91 98765 43210"
          autoComplete="tel"
        />
      </div>
      <div>
        <Label htmlFor="college">College</Label>
        <Input
          id="college"
          name="college"
          defaultValue={college ?? ''}
          placeholder="Your college"
        />
      </div>
      <div>
        <Label htmlFor="course">Course</Label>
        <Input
          id="course"
          name="course"
          defaultValue={course ?? ''}
          placeholder="Your course"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        {saved ? (
          <span className="text-sm text-success" role="status">
            Saved.
          </span>
        ) : null}
        {error ? (
          <span className="text-sm text-danger" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  )
}
