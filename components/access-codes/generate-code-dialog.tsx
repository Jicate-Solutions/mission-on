'use client'

// =============================================================================
// Mission ON — Smart Choices
// components/access-codes/generate-code-dialog.tsx — onboard a new admin/
// coordinator/mentor/learner by generating their access code. This is the
// account-creation path for every non-super-admin role (doc/update.md §3).
// =============================================================================

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Role } from '@/types/database'

import { generateAccessCode } from '@/app/(app)/super-admin/access-codes/_lib/actions'
import { ROLE_LABELS } from '@/components/roles/labels'
import { ShowCodeDialog } from './show-code-dialog'

// super_admin is never code-issuable — that role keeps email+password.
const ISSUABLE_ROLES: readonly Role[] = [
  'admin',
  'coordinator',
  'mentor',
  'learner',
]

export function GenerateCodeDialog() {
  const [open, setOpen] = React.useState(false)
  const [role, setRole] = React.useState<Role>('mentor')
  const [displayName, setDisplayName] = React.useState('')
  const [schoolId, setSchoolId] = React.useState('')
  const [pending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [issuedCode, setIssuedCode] = React.useState<string | null>(null)
  const [issuedFor, setIssuedFor] = React.useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('role', role)
    fd.set('displayName', displayName.trim())
    fd.set('schoolId', schoolId.trim())
    startTransition(async () => {
      const res = await generateAccessCode(fd)
      if (res.ok) {
        setIssuedFor(displayName.trim())
        setIssuedCode(res.code)
        setOpen(false)
      } else {
        setError(res.error ?? 'Could not generate the access code.')
      }
    })
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Generate access code
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="generate-code-title"
      >
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle id="generate-code-title">
              Generate an access code
            </DialogTitle>
            <DialogDescription>
              Creates a new account for this person and issues their permanent
              sign-in code. The code is shown once — copy it before closing.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Role
              <Select
                aria-label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                disabled={pending}
              >
                {ISSUABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Name
              <Input
                aria-label="Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Person's real name"
                disabled={pending}
                required
              />
            </label>
            {role === 'coordinator' ? (
              <label className="flex flex-col gap-1 text-sm text-ink">
                School ID
                <Input
                  aria-label="School ID"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  placeholder="Owned school id"
                  disabled={pending}
                />
              </label>
            ) : null}
            {error ? (
              <span className="text-xs text-danger" role="alert">
                {error}
              </span>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pending || !displayName.trim()}
            >
              {pending ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <ShowCodeDialog
        key={issuedCode ?? 'none'}
        open={issuedCode !== null}
        code={issuedCode ?? ''}
        displayName={issuedFor || 'this user'}
        onClose={() => {
          setIssuedCode(null)
          setDisplayName('')
          setSchoolId('')
          setRole('mentor')
        }}
      />
    </>
  )
}
