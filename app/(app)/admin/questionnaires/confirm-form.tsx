'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { ModuleCode } from '@/types/database'

import { confirmModuleCode, type ConfirmModuleState } from './actions'

const INITIAL: ConfirmModuleState = { ok: false, error: null }

const MODULE_CODES: ModuleCode[] = [
  'A1-B1',
  'A1-B2',
  'A1-B3',
  'A2-B1',
  'A2-B2',
  'A2-B3',
  'A3-B1',
  'A3-B2',
  'A3-B3',
]

/**
 * Divergence-confirm / module lock form (Admin-only). The default selection is
 * the existing confirmed code, else the computed code, so the common path is a
 * one-click confirm; an admin may override when resolving a divergence flag.
 */
export function ConfirmModuleForm({
  responseId,
  computedModuleCode,
  confirmedModuleCode,
  divergenceFlag,
}: {
  responseId: string
  computedModuleCode: ModuleCode | null
  confirmedModuleCode: ModuleCode | null
  divergenceFlag: boolean
}) {
  const [state, formAction, pending] = useActionState(confirmModuleCode, INITIAL)

  const defaultCode = confirmedModuleCode ?? computedModuleCode ?? ''

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="responseId" value={responseId} />

      {divergenceFlag ? (
        <p
          role="alert"
          className="rounded-md bg-[color-mix(in_srgb,var(--color-warning)_15%,white)] px-3 py-2 text-sm text-warning"
        >
          Demographic and behavioural signals diverge by more than one step.
          Confirm the module code manually before locking (PRD §6.4).
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="moduleCode" required>
          Module code
        </Label>
        <Select
          id="moduleCode"
          name="moduleCode"
          defaultValue={defaultCode}
          disabled={pending}
          className="max-w-48"
        >
          <option value="">— Select —</option>
          {MODULE_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
              {c === computedModuleCode ? ' (computed)' : ''}
            </option>
          ))}
        </Select>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          Module code confirmed and locked.
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Confirming…' : 'Confirm module code'}
        </Button>
      </div>
    </form>
  )
}
