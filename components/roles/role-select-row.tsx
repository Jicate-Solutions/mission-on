'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { Role } from '@/types/database'

import { setUserRole, setUserSubRole } from '@/app/api/roles/_lib/actions'
import { ROLE_LABELS, ROLE_ORDER } from './labels'

/**
 * Inline role control for one roster row. Submits the setUserRole Server Action
 * (which re-verifies role + mirrors RLS internally). Holds no sensitive data —
 * only the user id, email label, current role, and which roles this caller may
 * grant.
 *
 * `assignableRoles` is computed server-side from the caller's own role:
 *   - super_admin: all roles
 *   - admin: every role EXCEPT super_admin
 * When the target is currently super_admin and the caller is an admin, the whole
 * control is disabled (an admin may not modify a super_admin) — `locked`.
 */
export function RoleSelectRow({
  userId,
  currentRole,
  subRole,
  assignableRoles,
  locked = false,
  allowRevoke,
}: {
  userId: string
  currentRole: Role | null
  subRole: string | null
  assignableRoles: readonly Role[]
  locked?: boolean
  allowRevoke: boolean
}) {
  const [value, setValue] = React.useState<string>(currentRole ?? '')
  const [realName, setRealName] = React.useState('')
  const [counsellor, setCounsellor] = React.useState(
    subRole === 'jkkn_counsellor'
  )
  const [pending, startTransition] = React.useTransition()
  const [cPending, startCounsellor] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  function onToggleCounsellor(next: boolean) {
    setCounsellor(next)
    setError(null)
    const fd = new FormData()
    fd.set('userId', userId)
    fd.set('isCounsellor', String(next))
    startCounsellor(async () => {
      const res = await setUserSubRole(fd)
      if (!res.ok) {
        setCounsellor(!next) // revert on failure
        setError(res.error ?? 'Could not update counsellor designation.')
      }
    })
  }

  const dirty = value !== (currentRole ?? '')
  // Assigning mentor/learner provisions their profile + alias, which needs a real
  // name. We prompt for it whenever the admin is newly assigning either role.
  const needsRealName =
    dirty && (value === 'mentor' || value === 'learner')

  // If the current role is not in the assignable list (e.g. an admin viewing a
  // super_admin, or a legacy role), still show it as a disabled option so the
  // select reflects reality.
  const options = React.useMemo(() => {
    const set = new Set<string>(assignableRoles)
    const extras: Role[] = []
    if (currentRole && !set.has(currentRole)) extras.push(currentRole)
    return { extras }
  }, [assignableRoles, currentRole])

  function onSave() {
    setError(null)
    setSaved(false)
    const fd = new FormData()
    fd.set('userId', userId)
    fd.set('role', value)
    fd.set('realName', realName.trim())
    startTransition(async () => {
      const res = await setUserRole(fd)
      if (res.ok) {
        setSaved(true)
        setRealName('')
      } else {
        setError(res.error ?? 'Failed.')
        // Revert the select to the persisted value on failure. Keep the typed
        // real name so the admin can fix the role and retry without re-typing.
        setValue(currentRole ?? '')
      }
    })
  }

  const blockSave =
    locked || pending || !dirty || (needsRealName && realName.trim() === '')

  return (
    <div className="flex flex-col items-end gap-1">
      {needsRealName ? (
        <Input
          aria-label="Real name"
          value={realName}
          disabled={pending}
          onChange={(e) => setRealName(e.target.value)}
          placeholder={`Real name (creates ${value} profile)`}
          className="h-9 w-72 py-1 text-sm"
        />
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Select
          aria-label="Role"
          value={value}
          disabled={locked || pending}
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
          className="h-9 w-48 py-1 text-sm"
        >
          {allowRevoke ? <option value="">No role</option> : null}
          {ROLE_ORDER.filter((r) => assignableRoles.includes(r)).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
          {options.extras.map((r) => (
            <option key={r} value={r} disabled>
              {ROLE_LABELS[r]} (locked)
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          disabled={blockSave}
        >
          {pending ? '…' : 'Save'}
        </Button>
      </div>
      {currentRole !== null && !locked ? (
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={counsellor}
            disabled={cPending}
            onChange={(e) => onToggleCounsellor(e.target.checked)}
            className="size-3.5 accent-[var(--color-primary)]"
          />
          Safeguarding counsellor
        </label>
      ) : null}

      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
      {saved && !dirty ? (
        <span className="text-xs text-success" role="status">
          Saved
        </span>
      ) : null}
    </div>
  )
}
