'use client'

// =============================================================================
// Mission ON — Smart Choices
// components/modules/mentor-team-manager.tsx — Admin control to assign/remove
// the Mentor team for a session's school (PRD §7.4). Reuses the existing
// mentor_school_allocations table via the assign/unassign Server Actions, which
// re-verify admin internally. ALIAS-ONLY: this component never sees or holds a
// mentor's real identity — only the public alias + public id.
// =============================================================================

import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type {
  AssignedMentor,
  MentorOption,
} from '@/app/(app)/admin/modules/_lib/types'

import {
  assignMentorToSession,
  unassignMentorFromSession,
} from '@/app/(app)/admin/modules/_lib/actions'

export function MentorTeamManager({
  sessionId,
  assignedMentors,
  availableMentors,
}: {
  sessionId: string
  assignedMentors: AssignedMentor[]
  availableMentors: MentorOption[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState('')

  function onAssign() {
    if (!selected) {
      setError('Choose a mentor to assign.')
      return
    }
    setError(null)
    const fd = new FormData()
    fd.set('sessionId', sessionId)
    fd.set('mentorPublicId', selected)
    startTransition(async () => {
      const res = await assignMentorToSession(fd)
      if (!res.ok) setError(res.error ?? 'Failed to assign mentor.')
      else setSelected('')
    })
  }

  function onRemove(mentorPublicId: string) {
    setError(null)
    const fd = new FormData()
    fd.set('sessionId', sessionId)
    fd.set('mentorPublicId', mentorPublicId)
    startTransition(async () => {
      const res = await unassignMentorFromSession(fd)
      if (!res.ok) setError(res.error ?? 'Failed to remove mentor.')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mentor team</CardTitle>
        <CardDescription>
          The Mentors who will deliver and follow through for this session.
          Shown by alias. Assigning a mentor adds them to this session&apos;s
          team.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {assignedMentors.length === 0 ? (
          <p className="text-ink-muted">No mentors assigned yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {assignedMentors.map((m) => (
              <li
                key={m.mentorPublicId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium text-ink">{m.alias}</span>
                  {m.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="neutral">Inactive</Badge>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(m.mentorPublicId)}
                  disabled={pending}
                  className="text-danger hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,white)]"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="assign-mentor">Add a mentor</Label>
            <Select
              id="assign-mentor"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={pending || availableMentors.length === 0}
            >
              <option value="">
                {availableMentors.length === 0
                  ? 'No more mentors to assign'
                  : 'Select a mentor…'}
              </option>
              {availableMentors.map((m) => (
                <option key={m.mentorPublicId} value={m.mentorPublicId}>
                  {m.alias}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={onAssign} disabled={pending || !selected}>
            {pending ? 'Working…' : 'Assign'}
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
