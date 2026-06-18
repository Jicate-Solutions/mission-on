'use client'

import * as React from 'react'

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

import {
  allocateMentorToSchool,
  removeMentorAllocation,
} from '../_lib/actions'
import type { MentorAllocation, SchoolOption } from '../_lib/types'

/**
 * Admin control to allocate a mentor to schools and remove allocations. All
 * mutations go through Server Actions that re-verify admin internally. Holds
 * only non-sensitive data (school names + the mentor's PUBLIC id).
 */
export function AllocationManager({
  mentorPublicId,
  allocations,
  availableSchools,
}: {
  mentorPublicId: string
  allocations: MentorAllocation[]
  availableSchools: SchoolOption[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [selectedSchool, setSelectedSchool] = React.useState('')

  function onAllocate() {
    if (!selectedSchool) {
      setError('Choose a school to allocate.')
      return
    }
    setError(null)
    const fd = new FormData()
    fd.set('mentorPublicId', mentorPublicId)
    fd.set('schoolId', selectedSchool)
    startTransition(async () => {
      const res = await allocateMentorToSchool(fd)
      if (!res.ok) setError(res.error ?? 'Failed to allocate.')
      else setSelectedSchool('')
    })
  }

  function onRemove(allocationId: string) {
    setError(null)
    const fd = new FormData()
    fd.set('allocationId', allocationId)
    fd.set('mentorPublicId', mentorPublicId)
    startTransition(async () => {
      const res = await removeMentorAllocation(fd)
      if (!res.ok) setError(res.error ?? 'Failed to remove.')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>School allocations</CardTitle>
        <CardDescription>
          Allocate this mentor to the schools they will support. The
          availability calendar helps you schedule sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {allocations.length === 0 ? (
          <p className="text-ink-muted">Not allocated to any school yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {allocations.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="font-medium text-ink">{a.schoolName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(a.id)}
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
            <Label htmlFor="allocate-school">Add a school</Label>
            <Select
              id="allocate-school"
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              disabled={pending || availableSchools.length === 0}
            >
              <option value="">
                {availableSchools.length === 0
                  ? 'No more schools to allocate'
                  : 'Select a school…'}
              </option>
              {availableSchools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            onClick={onAllocate}
            disabled={pending || !selectedSchool}
          >
            {pending ? 'Working…' : 'Allocate'}
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
