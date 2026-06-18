'use client'

// =============================================================================
// Mission ON — Smart Choices
// components/mentors/mentor-profile-edit.tsx — Admin editor for a mentor's REAL
// profile (PRD §7.5). Shared by the admin and super-admin mentor detail pages.
// Submits updateMentorProfile, which re-verifies admin and writes under RLS.
// Alias is shown read-only (it is the public identity, managed elsewhere).
// =============================================================================

import * as React from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { updateMentorProfile } from '@/app/(app)/admin/mentors/_lib/actions'

export function MentorProfileEdit({
  mentorPublicId,
  alias,
  realName,
  phone,
  college,
  course,
}: {
  mentorPublicId: string
  alias: string
  realName: string
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
    fd.set('mentorPublicId', mentorPublicId)
    startTransition(async () => {
      const res = await updateMentorProfile(fd)
      if (res.ok) setSaved(true)
      else setError(res.error ?? 'Could not save.')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          The protected mentor profile. Editable by Admins and Super Admins; do
          not share outside the admin team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Alias</Label>
            <p className="mt-1 text-ink">{alias}</p>
          </div>
          <div>
            <Label htmlFor="realName">Real name</Label>
            <Input
              id="realName"
              name="realName"
              defaultValue={realName}
              maxLength={120}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={phone ?? ''} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="college">College</Label>
              <Input id="college" name="college" defaultValue={college ?? ''} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="course">Course</Label>
              <Input id="course" name="course" defaultValue={course ?? ''} maxLength={120} />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="text-sm text-success">
              Profile saved.
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
