'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  addAvailability,
  removeAvailability,
} from '../profile/_lib/actions'
import type { MentorOwnAvailabilitySlot } from '../profile/_lib/queries'

function formatTime(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

function slotRange(start: string | null, end: string | null): string {
  const s = formatTime(start)
  const e = formatTime(end)
  if (s && e) return `${s} – ${e}`
  if (s) return `from ${s}`
  return 'All day'
}

/**
 * Self-service availability manager. Add/remove slots via Server Actions that
 * re-verify the caller is a mentor and scope every write to the caller's own
 * profile. Holds only the caller's own non-identifying schedule data.
 */
export function AvailabilityManager({
  slots,
}: {
  slots: MentorOwnAvailabilitySlot[]
}) {
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await addAvailability(fd)
      if (!res.ok) setError(res.error ?? 'Could not add slot.')
      else formRef.current?.reset()
    })
  }

  function onRemove(slotId: string) {
    setError(null)
    const fd = new FormData()
    fd.set('slotId', slotId)
    startTransition(async () => {
      const res = await removeAvailability(fd)
      if (!res.ok) setError(res.error ?? 'Could not remove slot.')
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        ref={formRef}
        onSubmit={onAdd}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Label htmlFor="availableDate" required>
            Date
          </Label>
          <Input
            id="availableDate"
            name="availableDate"
            type="date"
            required
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="startTime">Start time</Label>
          <Input id="startTime" name="startTime" type="time" />
        </div>
        <div className="flex-1">
          <Label htmlFor="endTime">End time</Label>
          <Input id="endTime" name="endTime" type="time" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add slot'}
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {slots.length === 0 ? (
        <p className="text-ink-muted">
          No availability set yet. Add your first slot above.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slots.map((slot) => (
              <TableRow key={slot.id}>
                <TableCell className="font-medium">
                  {slot.availableDate}
                </TableCell>
                <TableCell>
                  {slotRange(slot.startTime, slot.endTime)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(slot.id)}
                    disabled={pending}
                    className="text-danger hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,white)]"
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
