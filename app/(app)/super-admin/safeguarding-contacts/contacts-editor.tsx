'use client'

import { useActionState, useState } from 'react'

import {
  saveSafeguardingContacts,
  type ContactsState,
} from './actions'
import {
  MAX_CONTACTS,
  type SafeguardingContact,
} from '@/app/(app)/admin/safeguarding/contacts-shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: ContactsState = { error: null, success: null }

/** Editable row (email always a string here for controlled inputs). */
interface Row {
  name: string
  roleTitle: string
  phone: string
  email: string
}

function toRow(c: SafeguardingContact): Row {
  return {
    name: c.name,
    roleTitle: c.roleTitle,
    phone: c.phone,
    email: c.email ?? '',
  }
}

const EMPTY_ROW: Row = { name: '', roleTitle: '', phone: '', email: '' }

/**
 * Super Admin editor for the named safeguarding contacts (PRD §12). Manages N
 * add/remove rows in local state and submits the whole array as JSON in a hidden
 * field. The Server Action re-verifies super_admin and re-validates every row.
 */
export function ContactsEditor({
  contacts,
}: {
  contacts: SafeguardingContact[]
}) {
  const [rows, setRows] = useState<Row[]>(
    contacts.length > 0 ? contacts.map(toRow) : [{ ...EMPTY_ROW }]
  )
  const [state, action, pending] = useActionState(
    saveSafeguardingContacts,
    initialState
  )

  function update(index: number, field: keyof Row, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  function addRow() {
    setRows((prev) =>
      prev.length >= MAX_CONTACTS ? prev : [...prev, { ...EMPTY_ROW }]
    )
  }

  function removeRow(index: number) {
    setRows((prev) =>
      prev.length <= 1 ? [{ ...EMPTY_ROW }] : prev.filter((_, i) => i !== index)
    )
  }

  // Only rows with a name + phone are sent; empty trailing rows are dropped.
  const payload = JSON.stringify(
    rows
      .map((r) => ({
        name: r.name.trim(),
        roleTitle: r.roleTitle.trim(),
        phone: r.phone.trim(),
        email: r.email.trim(),
      }))
      .filter((r) => r.name.length > 0 || r.phone.length > 0)
  )

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="contacts" value={payload} />

      <div className="flex flex-col gap-6">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor={`name-${i}`}>Name</Label>
              <Input
                id={`name-${i}`}
                value={row.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div>
              <Label htmlFor={`role-${i}`}>Role / title</Label>
              <Input
                id={`role-${i}`}
                value={row.roleTitle}
                onChange={(e) => update(i, 'roleTitle', e.target.value)}
                maxLength={200}
                placeholder="e.g. Designated Safeguarding Lead"
              />
            </div>
            <div>
              <Label htmlFor={`phone-${i}`}>Phone</Label>
              <Input
                id={`phone-${i}`}
                type="tel"
                value={row.phone}
                onChange={(e) => update(i, 'phone', e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div>
              <Label htmlFor={`email-${i}`}>Email (optional)</Label>
              <Input
                id={`email-${i}`}
                type="email"
                value={row.email}
                onChange={(e) => update(i, 'email', e.target.value)}
                maxLength={200}
                placeholder="Optional"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeRow(i)}
                className="w-fit text-danger"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={addRow}
          disabled={rows.length >= MAX_CONTACTS}
          className="w-fit"
        >
          Add contact
        </Button>
        <span className="text-xs text-ink-muted">
          {rows.length} / {MAX_CONTACTS}
        </span>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-success">
          {state.success}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? 'Saving…' : 'Save contacts'}
      </Button>
    </form>
  )
}
