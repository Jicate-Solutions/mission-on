'use client'

import { useState } from 'react'

import { triageBug } from '@/app/(app)/bug-reports/actions'
import {
  BUG_STATUSES,
  BUG_STATUS_LABEL,
  BUG_MAX_RESOLUTION,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABEL,
} from '@/app/(app)/bug-reports/bug-constants'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { BugStatus, BugSeverity } from '@/types/database'

export interface TriageFormProps {
  bugId: string
  currentStatus: BugStatus
  currentResolution: string | null
  currentSeverity: BugSeverity | null
  assignedToMe: boolean
}

/**
 * Admin triage control for one bug: change status, write a resolution, and
 * self-assign / unassign. Submits to the triageBug Server Action (admin-gated in
 * the DAL). Native form + controlled status select.
 */
export function TriageForm({
  bugId,
  currentStatus,
  currentResolution,
  currentSeverity,
  assignedToMe,
}: TriageFormProps) {
  const [status, setStatus] = useState<BugStatus>(currentStatus)

  return (
    <form action={triageBug} className="flex flex-col gap-3 border-t border-border pt-4">
      <input type="hidden" name="bugId" value={bugId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`status-${bugId}`}>Status</Label>
          <Select
            id={`status-${bugId}`}
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as BugStatus)}
          >
            {BUG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BUG_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor={`severity-${bugId}`}>Severity</Label>
          <Select
            id={`severity-${bugId}`}
            name="severity"
            defaultValue={currentSeverity ?? ''}
          >
            <option value="">— Unset —</option>
            {BUG_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {BUG_SEVERITY_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor={`assign-${bugId}`}>Assignment</Label>
          <Select id={`assign-${bugId}`} name="assign" defaultValue="">
            <option value="">{assignedToMe ? 'Assigned to me' : 'No change'}</option>
            {assignedToMe ? (
              <option value="clear">Unassign</option>
            ) : (
              <option value="self">Assign to me</option>
            )}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor={`resolution-${bugId}`}>Resolution notes</Label>
        <Textarea
          id={`resolution-${bugId}`}
          name="resolution"
          rows={2}
          maxLength={BUG_MAX_RESOLUTION}
          defaultValue={currentResolution ?? ''}
          placeholder="What was done (visible to the reporter)."
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm">
          Update report
        </Button>
      </div>
    </form>
  )
}
